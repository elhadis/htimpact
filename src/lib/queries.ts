import { prisma } from "@/lib/prisma";
import { buildProgress, type ProgressInput } from "@/lib/progress";
import type { AttendanceStatus, ProjectStatus, ProjectType } from "@prisma/client";

const progressInclude = {
  targets: true,
  beneficiaries: { select: { status: true } },
  activities: { select: { logs: { select: { participated: true } } } },
  courses: {
    select: {
      cohorts: {
        select: { sessions: { select: { attendance: { select: { status: true } } } } },
      },
    },
  },
} as const;

type ProgressProject = {
  targets: { metricKey: string; label: string; targetValue: number; unit: string }[];
  beneficiaries: { status: string }[];
  activities: { logs: { participated: boolean }[] }[];
  courses: { cohorts: { sessions: { attendance: { status: AttendanceStatus }[] }[] }[] }[];
};

export function progressFromProject(project: ProgressProject) {
  let sessionCount = 0;
  let attendanceMarked = 0;
  let attendancePositive = 0;
  for (const course of project.courses) {
    for (const cohort of course.cohorts) {
      sessionCount += cohort.sessions.length;
      for (const session of cohort.sessions) {
        for (const mark of session.attendance) {
          attendanceMarked += 1;
          if (mark.status === "PRESENT" || mark.status === "LATE") attendancePositive += 1;
        }
      }
    }
  }
  const input: ProgressInput = {
    targets: project.targets,
    beneficiaryCount: project.beneficiaries.filter((row) => row.status !== "withdrawn").length,
    sessionCount,
    attendanceMarked,
    attendancePositive,
    activityCount: project.activities.length,
    participationCount: project.activities.reduce(
      (sum, activity) => sum + activity.logs.filter((log) => log.participated).length,
      0,
    ),
  };
  return buildProgress(input);
}

export async function dashboardData() {
  const [projects, beneficiaryCount, conflictCount, audits, attendance] = await Promise.all([
    prisma.project.findMany({
      where: { status: { in: ["ACTIVE", "ON_HOLD"] } },
      include: progressInclude,
      orderBy: { name: "asc" },
    }),
    prisma.beneficiary.count(),
    prisma.syncConflict.count({ where: { status: "pending" } }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { user: { select: { name: true } } },
    }),
    prisma.attendanceRecord.findMany({ select: { status: true } }),
  ]);
  const positive = attendance.filter((row) => row.status === "PRESENT" || row.status === "LATE").length;
  const attendanceRate = attendance.length === 0 ? 0 : Math.round((positive / attendance.length) * 100);
  return {
    beneficiaryCount,
    conflictCount,
    activeProjects: projects.length,
    attendanceRate,
    projects: projects.map((project) => ({
      id: project.id,
      name: project.name,
      code: project.code,
      type: project.type,
      status: project.status,
      progress: progressFromProject(project),
    })),
    audits: audits.map((entry) => ({
      id: entry.id,
      summary: entry.summary,
      action: entry.action,
      createdAt: entry.createdAt.toISOString(),
      actor: entry.user?.name ?? "System",
    })),
  };
}

export async function listProjects() {
  const projects = await prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
    include: progressInclude,
  });
  return projects.map((project) => ({
    id: project.id,
    code: project.code,
    name: project.name,
    type: project.type as ProjectType,
    status: project.status as ProjectStatus,
    location: project.location,
    startDate: project.startDate.toISOString(),
    endDate: project.endDate?.toISOString() ?? null,
    progress: progressFromProject(project).overall,
    beneficiaryCount: project.beneficiaries.filter((row) => row.status !== "withdrawn").length,
  }));
}

export async function getProject(id: string) {
  return prisma.project.findUnique({
    where: { id },
    include: {
      targets: { orderBy: { label: "asc" } },
      beneficiaries: {
        include: { beneficiary: true },
        orderBy: { enrolledAt: "desc" },
      },
      staff: {
        include: {
          user: { select: { id: true, name: true, email: true, title: true, role: true } },
        },
      },
      courses: {
        orderBy: { name: "asc" },
        include: {
          cohorts: {
            orderBy: { startDate: "asc" },
            include: {
              enrollments: { where: { status: "active" } },
              sessions: {
                orderBy: { scheduledAt: "asc" },
                include: {
                  facilitator: { select: { id: true, name: true } },
                  attendance: { select: { status: true } },
                },
              },
            },
          },
        },
      },
      activities: {
        orderBy: { scheduledAt: "asc" },
        include: {
          logs: { include: { beneficiary: true } },
        },
      },
    },
  });
}

export async function listBeneficiaries() {
  const people = await prisma.beneficiary.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    include: {
      projects: { include: { project: { select: { id: true, name: true, code: true } } } },
    },
  });
  return people.map((person) => ({
    id: person.id,
    code: person.code,
    name: `${person.firstName} ${person.lastName}`,
    gender: person.gender,
    community: person.community,
    nationalId: person.nationalId,
    phone: person.phone,
    projectCount: person.projects.filter((link) => link.status !== "withdrawn").length,
    projects: person.projects
      .filter((link) => link.status !== "withdrawn")
      .map((link) => link.project.name)
      .join(", "),
  }));
}

export async function getBeneficiary(id: string) {
  return prisma.beneficiary.findUnique({
    where: { id },
    include: {
      projects: { include: { project: true }, orderBy: { enrolledAt: "desc" } },
      enrollments: {
        include: { cohort: { include: { course: { include: { project: true } } } } },
        orderBy: { enrolledAt: "desc" },
      },
      attendance: {
        include: { session: { include: { cohort: { include: { course: true } } } } },
        orderBy: { recordedAt: "desc" },
        take: 12,
      },
    },
  });
}

export async function listCourses() {
  return prisma.course.findMany({
    orderBy: { name: "asc" },
    include: {
      project: { select: { id: true, name: true, code: true, type: true } },
      cohorts: { select: { id: true } },
    },
  });
}

export async function getCourse(id: string) {
  return prisma.course.findUnique({
    where: { id },
    include: {
      project: true,
      cohorts: {
        orderBy: { startDate: "asc" },
        include: { _count: { select: { enrollments: true, sessions: true } } },
      },
    },
  });
}

export async function listCohorts() {
  return prisma.cohort.findMany({
    orderBy: { startDate: "desc" },
    include: {
      course: { include: { project: { select: { name: true, code: true } } } },
      _count: { select: { enrollments: true, sessions: true } },
    },
  });
}

export async function getCohort(id: string) {
  return prisma.cohort.findUnique({
    where: { id },
    include: {
      course: { include: { project: true } },
      enrollments: { include: { beneficiary: true }, orderBy: { enrolledAt: "desc" } },
      sessions: { orderBy: { scheduledAt: "asc" }, include: { facilitator: true } },
    },
  });
}

export async function listSessions() {
  const sessions = await prisma.session.findMany({
    orderBy: { scheduledAt: "desc" },
    include: {
      facilitator: { select: { name: true } },
      cohort: {
        include: {
          course: { include: { project: { select: { id: true, name: true } } } },
          enrollments: { where: { status: "active" }, select: { id: true } },
        },
      },
      _count: { select: { attendance: true } },
    },
  });
  return sessions.map((session) => ({
    id: session.id,
    title: session.title,
    scheduledAt: session.scheduledAt.toISOString(),
    location: session.location,
    facilitator: session.facilitator?.name ?? "",
    cohort: session.cohort.name,
    course: session.cohort.course.name,
    project: session.cohort.course.project.name,
    projectId: session.cohort.course.project.id,
    enrolled: session.cohort.enrollments.length,
    marked: session._count.attendance,
  }));
}

export async function getAttendanceSheet(sessionId: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      facilitator: { select: { name: true } },
      attendance: true,
      cohort: {
        include: {
          course: { include: { project: true } },
          enrollments: {
            where: { status: "active" },
            include: { beneficiary: true },
            orderBy: { beneficiary: { lastName: "asc" } },
          },
        },
      },
    },
  });
  if (!session) return null;
  return {
    id: session.id,
    title: session.title,
    scheduledAt: session.scheduledAt.toISOString(),
    durationMin: session.durationMin,
    location: session.location,
    facilitator: session.facilitator?.name ?? "",
    projectId: session.cohort.course.project.id,
    projectName: session.cohort.course.project.name,
    courseName: session.cohort.course.name,
    cohortName: session.cohort.name,
    rows: session.cohort.enrollments.map((enrollment) => {
      const mark = session.attendance.find((row) => row.beneficiaryId === enrollment.beneficiaryId);
      return {
        beneficiaryId: enrollment.beneficiaryId,
        name: `${enrollment.beneficiary.firstName} ${enrollment.beneficiary.lastName}`,
        code: enrollment.beneficiary.code,
        status: mark?.status ?? "",
        note: mark?.note ?? "",
        updatedAt: mark?.updatedAt.toISOString() ?? null,
      };
    }),
  };
}

export async function listStaff() {
  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      title: true,
      active: true,
      isDemo: true,
      role: true,
      projectAssignments: { include: { project: { select: { name: true } } } },
    },
  });
  return users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    title: user.title,
    active: user.active,
    isDemo: user.isDemo,
    role: user.role.key,
    projects: user.projectAssignments.map((link) => link.project.name).join(", "),
  }));
}

export async function getStaff(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      title: true,
      active: true,
      isDemo: true,
      role: true,
      projectAssignments: { select: { projectId: true } },
    },
  });
}

export async function listAudit() {
  const rows = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { user: { select: { name: true, email: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    entityType: row.entityType,
    summary: row.summary,
    createdAt: row.createdAt.toISOString(),
    actor: row.user?.name ?? "System",
  }));
}

export async function listConflicts() {
  const rows = await prisma.syncConflict.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return rows.map((row) => ({
    id: row.id,
    entityType: row.entityType,
    rule: row.rule,
    message: row.message,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
  }));
}

export async function optionLists() {
  const [projects, courses, cohorts, people, staff] = await Promise.all([
    prisma.project.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true, type: true, status: true },
    }),
    prisma.course.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true, projectId: true, project: { select: { name: true } } },
    }),
    prisma.cohort.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        courseId: true,
        course: { select: { name: true, projectId: true, project: { select: { name: true } } } },
      },
    }),
    prisma.beneficiary.findMany({
      orderBy: { lastName: "asc" },
      select: { id: true, firstName: true, lastName: true, code: true },
    }),
    prisma.user.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: { select: { key: true } } },
    }),
  ]);
  return {
    projects,
    courses: courses.map((course) => ({
      id: course.id,
      name: course.name,
      code: course.code,
      projectId: course.projectId,
      projectName: course.project.name,
    })),
    cohorts: cohorts.map((cohort) => ({
      id: cohort.id,
      name: cohort.name,
      courseId: cohort.courseId,
      courseName: cohort.course.name,
      projectId: cohort.course.projectId,
      projectName: cohort.course.project.name,
    })),
    people: people.map((person) => ({
      id: person.id,
      name: `${person.firstName} ${person.lastName}`,
      code: person.code,
    })),
    staff: staff.map((user) => ({ id: user.id, name: user.name, role: user.role.key })),
  };
}

export async function buildReport(projectId?: string) {
  const projects = await prisma.project.findMany({
    where: projectId ? { id: projectId } : undefined,
    orderBy: { name: "asc" },
    include: {
      ...progressInclude,
      beneficiaries: {
        include: { beneficiary: true },
        orderBy: { beneficiary: { lastName: "asc" } },
      },
      courses: {
        include: {
          cohorts: {
            include: {
              sessions: {
                orderBy: { scheduledAt: "asc" },
                include: { attendance: true },
              },
            },
          },
        },
      },
      activities: { include: { logs: true }, orderBy: { name: "asc" } },
    },
  });

  return {
    generatedAt: new Date().toISOString(),
    projects: projects.map((project) => {
      const progress = progressFromProject(project);
      const sessions = project.courses.flatMap((course) =>
        course.cohorts.flatMap((cohort) =>
          cohort.sessions.map((session) => {
            const counts = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
            for (const mark of session.attendance) counts[mark.status] += 1;
            const marked = session.attendance.length;
            const rate = marked === 0 ? 0 : Math.round(((counts.PRESENT + counts.LATE) / marked) * 100);
            return {
              title: session.title,
              when: session.scheduledAt.toISOString(),
              course: course.name,
              cohort: cohort.name,
              ...counts,
              marked,
              rate,
            };
          }),
        ),
      );
      return {
        id: project.id,
        code: project.code,
        name: project.name,
        type: project.type,
        status: project.status,
        location: project.location,
        donor: project.donor,
        description: project.description,
        startDate: project.startDate.toISOString(),
        endDate: project.endDate?.toISOString() ?? null,
        progress: progress.overall,
        metrics: progress.metrics,
        beneficiaries: project.beneficiaries.map((link) => ({
          code: link.beneficiary.code,
          name: `${link.beneficiary.firstName} ${link.beneficiary.lastName}`,
          gender: link.beneficiary.gender,
          community: link.beneficiary.community,
          status: link.status,
        })),
        sessions,
        activities: project.activities.map((activity) => ({
          name: activity.name,
          when: activity.scheduledAt?.toISOString() ?? null,
          participated: activity.logs.filter((log) => log.participated).length,
          total: activity.logs.length,
        })),
      };
    }),
  };
}
