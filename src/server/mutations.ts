"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { guard, facilitatorAssigned } from "@/lib/guard";
import { writeAudit } from "@/lib/audit";
import { parseDateInput } from "@/lib/format";
import { isUniqueConflict } from "@/lib/utils";
import { metricsForType } from "@/lib/progress";
import {
  activitySchema,
  assignmentMutationSchema,
  attendanceRowSchema,
  beneficiarySchema,
  cohortSchema,
  courseSchema,
  projectSchema,
  sessionSchema,
  staffSchema,
  staffUpdateSchema,
} from "@/lib/validators";
import {
  applyAssignmentMutation,
  applyAttendanceMutation,
  forceResolveConflict,
  type AssignmentMutation,
  type AttendanceMutation,
} from "@/lib/sync/apply";

function refresh(paths: string[]) {
  for (const locale of ["en", "ar"]) {
    for (const path of paths) revalidatePath(`/${locale}${path}`);
  }
}

function fail(error: string) {
  return { ok: false as const, error };
}

function emptyToNull(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

async function nextBeneficiaryCode() {
  const count = await prisma.beneficiary.count();
  for (let offset = 1; offset <= 30; offset += 1) {
    const code = `BEN-${String(count + offset).padStart(4, "0")}`;
    const existing = await prisma.beneficiary.findUnique({ where: { code } });
    if (!existing) return code;
  }
  return `BEN-${Date.now().toString(36).toUpperCase()}`;
}

export async function createProject(input: unknown) {
  const access = await guard("projects", "create");
  if (!access.ok) return fail(access.error);
  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) return fail("invalid");
  const data = parsed.data;
  const allowed = new Set<string>(metricsForType(data.type));
  if (data.targets.some((target) => !allowed.has(target.metricKey))) return fail("invalid");
  try {
    const project = await prisma.project.create({
      data: {
        code: data.code.toUpperCase(),
        name: data.name,
        description: emptyToNull(data.description),
        type: data.type,
        status: data.status,
        startDate: parseDateInput(data.startDate),
        endDate: data.endDate ? parseDateInput(data.endDate) : null,
        location: emptyToNull(data.location),
        donor: emptyToNull(data.donor),
        targets: { create: data.targets },
      },
    });
    await writeAudit({
      userId: access.session.user.id,
      action: "CREATE",
      entityType: "Project",
      entityId: project.id,
      summary: `Created project ${project.code} · ${project.name}`,
    });
    refresh(["/dashboard", "/projects", `/projects/${project.id}`, "/reports"]);
    return { ok: true as const, id: project.id };
  } catch (error) {
    if (isUniqueConflict(error)) return fail("unique");
    throw error;
  }
}

export async function updateProject(id: string, input: unknown) {
  const access = await guard("projects", "update");
  if (!access.ok) return fail(access.error);
  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) return fail("invalid");
  const data = parsed.data;
  const allowed = new Set<string>(metricsForType(data.type));
  if (data.targets.some((target) => !allowed.has(target.metricKey))) return fail("invalid");
  try {
    await prisma.$transaction([
      prisma.projectTarget.deleteMany({ where: { projectId: id } }),
      prisma.project.update({
        where: { id },
        data: {
          code: data.code.toUpperCase(),
          name: data.name,
          description: emptyToNull(data.description),
          type: data.type,
          status: data.status,
          startDate: parseDateInput(data.startDate),
          endDate: data.endDate ? parseDateInput(data.endDate) : null,
          location: emptyToNull(data.location),
          donor: emptyToNull(data.donor),
          targets: { create: data.targets },
        },
      }),
    ]);
    await writeAudit({
      userId: access.session.user.id,
      action: "UPDATE",
      entityType: "Project",
      entityId: id,
      summary: `Updated project ${data.code.toUpperCase()} · ${data.name}`,
    });
    refresh(["/dashboard", "/projects", `/projects/${id}`, "/reports"]);
    return { ok: true as const, id };
  } catch (error) {
    if (isUniqueConflict(error)) return fail("unique");
    throw error;
  }
}

export async function createBeneficiary(input: unknown) {
  const access = await guard("beneficiaries", "create");
  if (!access.ok) return fail(access.error);
  const parsed = beneficiarySchema.safeParse(input);
  if (!parsed.success) return fail("invalid");
  const data = parsed.data;
  const nationalId = emptyToNull(data.nationalId);
  if (nationalId) {
    const existing = await prisma.beneficiary.findUnique({ where: { nationalId } });
    if (existing) return fail("duplicatePerson");
  }
  try {
    const person = await prisma.beneficiary.create({
      data: {
        code: await nextBeneficiaryCode(),
        firstName: data.firstName,
        lastName: data.lastName,
        gender: data.gender,
        dateOfBirth: data.dateOfBirth ? parseDateInput(data.dateOfBirth) : null,
        phone: emptyToNull(data.phone),
        nationalId,
        community: emptyToNull(data.community),
        notes: emptyToNull(data.notes),
        projects: {
          create: data.projectIds.map((projectId) => ({ projectId, status: "active" })),
        },
      },
    });
    await writeAudit({
      userId: access.session.user.id,
      action: "CREATE",
      entityType: "Beneficiary",
      entityId: person.id,
      summary: `Registered beneficiary ${person.code} · ${person.firstName} ${person.lastName}`,
    });
    refresh(["/dashboard", "/beneficiaries", `/beneficiaries/${person.id}`, "/projects"]);
    return { ok: true as const, id: person.id };
  } catch (error) {
    if (isUniqueConflict(error)) return fail("duplicatePerson");
    throw error;
  }
}

export async function updateBeneficiary(id: string, input: unknown) {
  const access = await guard("beneficiaries", "update");
  if (!access.ok) return fail(access.error);
  const parsed = beneficiarySchema.safeParse(input);
  if (!parsed.success) return fail("invalid");
  const data = parsed.data;
  const nationalId = emptyToNull(data.nationalId);
  try {
    await prisma.beneficiary.update({
      where: { id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        gender: data.gender,
        dateOfBirth: data.dateOfBirth ? parseDateInput(data.dateOfBirth) : null,
        phone: emptyToNull(data.phone),
        nationalId,
        community: emptyToNull(data.community),
        notes: emptyToNull(data.notes),
      },
    });
  } catch (error) {
    if (isUniqueConflict(error)) return fail("duplicatePerson");
    throw error;
  }

  const current = await prisma.projectBeneficiary.findMany({ where: { beneficiaryId: id } });
  const selected = new Set(data.projectIds);
  for (const link of current) {
    if (!selected.has(link.projectId) && link.status !== "withdrawn") {
      await applyAssignmentMutation(access.session.user.id, {
        projectId: link.projectId,
        beneficiaryId: id,
        op: "WITHDRAW",
        note: null,
        baseUpdatedAt: link.updatedAt.toISOString(),
        baseNotes: link.notes,
        clientMutationId: crypto.randomUUID(),
      });
    }
    if (selected.has(link.projectId) && link.status === "withdrawn") {
      await applyAssignmentMutation(access.session.user.id, {
        projectId: link.projectId,
        beneficiaryId: id,
        op: "ASSIGN",
        note: link.notes,
        baseUpdatedAt: link.updatedAt.toISOString(),
        baseNotes: link.notes,
        clientMutationId: crypto.randomUUID(),
      });
    }
  }
  for (const projectId of data.projectIds) {
    if (!current.some((link) => link.projectId === projectId)) {
      await applyAssignmentMutation(access.session.user.id, {
        projectId,
        beneficiaryId: id,
        op: "ASSIGN",
        note: null,
        baseUpdatedAt: null,
        baseNotes: null,
        clientMutationId: crypto.randomUUID(),
      });
    }
  }

  await writeAudit({
    userId: access.session.user.id,
    action: "UPDATE",
    entityType: "Beneficiary",
    entityId: id,
    summary: `Updated beneficiary ${data.firstName} ${data.lastName}`,
  });
  refresh(["/beneficiaries", `/beneficiaries/${id}`, "/projects", "/dashboard"]);
  return { ok: true as const, id };
}

export async function assignBeneficiary(input: unknown) {
  const access = await guard("beneficiaries", "update");
  if (!access.ok) return fail(access.error);
  const parsed = assignmentMutationSchema.safeParse(input);
  if (!parsed.success) return fail("invalid");
  const result = await applyAssignmentMutation(access.session.user.id, {
    ...parsed.data,
    note: emptyToNull(parsed.data.note),
  });
  refresh(["/projects", "/beneficiaries", "/dashboard", "/sync"]);
  return { ok: true as const, result };
}

export async function createCourse(input: unknown) {
  const access = await guard("courses", "create");
  if (!access.ok) return fail(access.error);
  const mutationId = input && typeof input === "object" && "clientMutationId" in input && typeof input.clientMutationId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.clientMutationId) ? input.clientMutationId : null;
  const parsed = courseSchema.safeParse(input);
  if (!parsed.success) return fail("invalid");
  const project = await prisma.project.findUnique({ where: { id: parsed.data.projectId } });
  if (!project) return fail("notFound");
  if (project.type !== "EDUCATIONAL") return fail("notEducational");
  try {
    const course = await prisma.course.create({
      data: {
        ...(mutationId ? { id: mutationId } : {}),
        projectId: project.id,
        code: parsed.data.code.toUpperCase(),
        name: parsed.data.name,
        description: emptyToNull(parsed.data.description),
        hours: parsed.data.hours === "" || parsed.data.hours === undefined ? null : Number(parsed.data.hours),
      },
    });
    await writeAudit({
      userId: access.session.user.id,
      action: "CREATE",
      entityType: "Course",
      entityId: course.id,
      summary: `Created course ${course.code} · ${course.name}`,
    });
    refresh(["/courses", `/courses/${course.id}`, `/projects/${project.id}`]);
    return { ok: true as const, id: course.id };
  } catch (error) {
    if (isUniqueConflict(error)) {
      if (mutationId) {
        const existing = await prisma.course.findUnique({ where: { id: mutationId } });
        if (existing && existing.projectId === project.id && existing.code === parsed.data.code.toUpperCase() && existing.name === parsed.data.name) {
          return { ok: true as const, id: existing.id };
        }
      }
      return fail("unique");
    }
    throw error;
  }
}

export async function createCohort(input: unknown) {
  const access = await guard("cohorts", "create");
  if (!access.ok) return fail(access.error);
  const parsed = cohortSchema.safeParse(input);
  if (!parsed.success) return fail("invalid");
  const course = await prisma.course.findUnique({ where: { id: parsed.data.courseId } });
  if (!course) return fail("notFound");
  const cohort = await prisma.cohort.create({
    data: {
      courseId: course.id,
      name: parsed.data.name,
      startDate: parseDateInput(parsed.data.startDate),
      endDate: parsed.data.endDate ? parseDateInput(parsed.data.endDate) : null,
      capacity:
        parsed.data.capacity === "" || parsed.data.capacity === undefined
          ? null
          : Number(parsed.data.capacity),
      location: emptyToNull(parsed.data.location),
    },
  });
  await writeAudit({
    userId: access.session.user.id,
    action: "CREATE",
    entityType: "Cohort",
    entityId: cohort.id,
    summary: `Created cohort ${cohort.name}`,
  });
  refresh(["/cohorts", `/cohorts/${cohort.id}`, `/courses/${course.id}`, `/projects/${course.projectId}`]);
  return { ok: true as const, id: cohort.id };
}

export async function enrollBeneficiary(input: { cohortId: string; beneficiaryId: string }) {
  const access = await guard("cohorts", "update");
  if (!access.ok) return fail(access.error);
  const cohort = await prisma.cohort.findUnique({
    where: { id: input.cohortId },
    include: { course: true },
  });
  const person = await prisma.beneficiary.findUnique({ where: { id: input.beneficiaryId } });
  if (!cohort || !person) return fail("notFound");
  if (cohort.course.projectId) {
    const link = await prisma.projectBeneficiary.findUnique({
      where: {
        projectId_beneficiaryId: {
          projectId: cohort.course.projectId,
          beneficiaryId: person.id,
        },
      },
    });
    const assignment = await applyAssignmentMutation(access.session.user.id, {
      projectId: cohort.course.projectId,
      beneficiaryId: person.id,
      op: "ASSIGN",
      note: link?.notes ?? null,
      baseUpdatedAt: link?.updatedAt.toISOString() ?? null,
      baseNotes: link?.notes ?? null,
      clientMutationId: crypto.randomUUID(),
    });
    if (assignment.result === "conflict" || assignment.result === "rejected") {
      return fail(assignment.rule ?? "conflict");
    }
  }
  await prisma.cohortEnrollment.upsert({
    where: { cohortId_beneficiaryId: { cohortId: cohort.id, beneficiaryId: person.id } },
    create: { cohortId: cohort.id, beneficiaryId: person.id, status: "active" },
    update: { status: "active" },
  });
  await writeAudit({
    userId: access.session.user.id,
    action: "CREATE",
    entityType: "CohortEnrollment",
    entityId: `${cohort.id}:${person.id}`,
    summary: `Enrolled ${person.firstName} ${person.lastName} in ${cohort.name}`,
  });
  refresh([
    `/cohorts/${cohort.id}`,
    `/beneficiaries/${person.id}`,
    `/projects/${cohort.course.projectId}`,
    "/attendance",
  ]);
  return { ok: true as const, id: cohort.id };
}

export async function createSession(input: unknown) {
  const access = await guard("sessions", "create");
  if (!access.ok) return fail(access.error);
  const parsed = sessionSchema.safeParse(input);
  if (!parsed.success) return fail("invalid");
  const cohort = await prisma.cohort.findUnique({
    where: { id: parsed.data.cohortId },
    include: { course: true },
  });
  if (!cohort) return fail("notFound");
  const session = await prisma.session.create({
    data: {
      cohortId: cohort.id,
      title: parsed.data.title,
      scheduledAt: new Date(parsed.data.scheduledAt),
      durationMin: parsed.data.durationMin,
      location: emptyToNull(parsed.data.location),
      facilitatorId: emptyToNull(parsed.data.facilitatorId),
      notes: emptyToNull(parsed.data.notes),
    },
  });
  await writeAudit({
    userId: access.session.user.id,
    action: "CREATE",
    entityType: "Session",
    entityId: session.id,
    summary: `Scheduled session ${session.title}`,
  });
  refresh([
    "/sessions",
    "/attendance",
    `/attendance/${session.id}`,
    `/cohorts/${cohort.id}`,
    `/projects/${cohort.course.projectId}`,
  ]);
  return { ok: true as const, id: session.id };
}

export async function saveAttendance(input: { sessionId: string; rows: unknown[] }) {
  const access = await guard("attendance", "update");
  if (!access.ok) return fail(access.error);
  const session = await prisma.session.findUnique({
    where: { id: input.sessionId },
    include: { cohort: { include: { course: true } } },
  });
  if (!session) return fail("notFound");
  const allowed = await facilitatorAssigned(
    access.session.user.id,
    access.session.user.role,
    session.cohort.course.projectId,
  );
  if (!allowed) return fail("notAssigned");
  const rows = input.rows
    .map((row) => attendanceRowSchema.safeParse(row))
    .filter((row) => row.success)
    .map((row) => row.data);
  if (rows.length === 0) return fail("invalid");
  const results = [];
  for (const row of rows) {
    const mutation: AttendanceMutation = {
      sessionId: input.sessionId,
      beneficiaryId: row.beneficiaryId,
      status: row.status,
      note: emptyToNull(row.note),
      recordedAt: row.recordedAt,
      baseUpdatedAt: row.baseUpdatedAt,
      clientMutationId: row.clientMutationId,
      source: "server",
    };
    results.push(await applyAttendanceMutation(access.session.user.id, mutation));
  }
  const applied = results.filter((result) => result.result === "applied").length;
  if (applied > 0) {
    await writeAudit({
      userId: access.session.user.id,
      action: "UPDATE",
      entityType: "AttendanceRecord",
      entityId: session.id,
      summary: `Updated attendance for ${applied} people in ${session.title}`,
    });
  }
  refresh([
    "/attendance",
    `/attendance/${session.id}`,
    "/dashboard",
    `/projects/${session.cohort.course.projectId}`,
    "/reports",
    "/sync",
  ]);
  return { ok: true as const, results };
}

export async function createActivity(input: unknown) {
  const access = await guard("activities", "create");
  if (!access.ok) return fail(access.error);
  const parsed = activitySchema.safeParse(input);
  if (!parsed.success) return fail("invalid");
  const project = await prisma.project.findUnique({ where: { id: parsed.data.projectId } });
  if (!project) return fail("notFound");
  if (project.type !== "NON_EDUCATIONAL") return fail("notActivity");
  const activity = await prisma.activity.create({
    data: {
      projectId: project.id,
      name: parsed.data.name,
      description: emptyToNull(parsed.data.description),
      scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null,
      location: emptyToNull(parsed.data.location),
    },
  });
  await writeAudit({
    userId: access.session.user.id,
    action: "CREATE",
    entityType: "Activity",
    entityId: activity.id,
    summary: `Created activity ${activity.name}`,
  });
  refresh([`/projects/${project.id}`, "/reports", "/dashboard"]);
  return { ok: true as const, id: activity.id };
}

export async function saveParticipation(input: {
  activityId: string;
  rows: { beneficiaryId: string; participated: boolean; note?: string }[];
}) {
  const access = await guard("activities", "update");
  if (!access.ok) return fail(access.error);
  const activity = await prisma.activity.findUnique({ where: { id: input.activityId } });
  if (!activity) return fail("notFound");
  const allowed = await facilitatorAssigned(access.session.user.id, access.session.user.role, activity.projectId);
  if (!allowed) return fail("notAssigned");
  for (const row of input.rows) {
    await prisma.participationLog.upsert({
      where: { activityId_beneficiaryId: { activityId: activity.id, beneficiaryId: row.beneficiaryId } },
      create: {
        activityId: activity.id,
        beneficiaryId: row.beneficiaryId,
        participated: row.participated,
        note: emptyToNull(row.note),
      },
      update: { participated: row.participated, note: emptyToNull(row.note) },
    });
  }
  await writeAudit({
    userId: access.session.user.id,
    action: "UPDATE",
    entityType: "ParticipationLog",
    entityId: activity.id,
    summary: `Logged participation for ${input.rows.length} people in ${activity.name}`,
  });
  refresh([`/projects/${activity.projectId}`, "/reports", "/dashboard"]);
  return { ok: true as const };
}

export async function createStaff(input: unknown) {
  const access = await guard("staff", "create");
  if (!access.ok) return fail(access.error);
  const parsed = staffSchema.safeParse(input);
  if (!parsed.success) return fail("invalid");
  const role = await prisma.role.findUnique({ where: { key: parsed.data.role } });
  if (!role) return fail("invalid");
  try {
    const user = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email.toLowerCase(),
        passwordHash: await bcrypt.hash(parsed.data.password, 10),
        phone: emptyToNull(parsed.data.phone),
        title: emptyToNull(parsed.data.title),
        roleId: role.id,
        projectAssignments: {
          create: parsed.data.projectIds.map((projectId) => ({ projectId })),
        },
      },
    });
    await writeAudit({
      userId: access.session.user.id,
      action: "CREATE",
      entityType: "User",
      entityId: user.id,
      summary: `Added staff ${user.name} as ${role.name}`,
    });
    refresh(["/staff", `/staff/${user.id}/edit`]);
    return { ok: true as const, id: user.id };
  } catch (error) {
    if (isUniqueConflict(error)) return fail("unique");
    throw error;
  }
}

export async function updateStaff(id: string, input: unknown) {
  const access = await guard("staff", "update");
  if (!access.ok) return fail(access.error);
  const parsed = staffUpdateSchema.safeParse(input);
  if (!parsed.success) return fail("invalid");
  const role = await prisma.role.findUnique({ where: { key: parsed.data.role } });
  const current = await prisma.user.findUnique({ where: { id }, include: { role: true } });
  if (!role || !current) return fail("notFound");
  if (current.role.key === "ADMIN" && parsed.data.role !== "ADMIN") {
    const admins = await prisma.user.count({
      where: { active: true, role: { key: "ADMIN" }, NOT: { id } },
    });
    if (admins === 0) return fail("lastAdmin");
  }
  if (current.role.key === "ADMIN" && parsed.data.active === false) {
    const admins = await prisma.user.count({
      where: { active: true, role: { key: "ADMIN" }, NOT: { id } },
    });
    if (admins === 0) return fail("lastAdmin");
  }
  try {
    await prisma.$transaction([
      prisma.projectStaff.deleteMany({ where: { userId: id } }),
      prisma.user.update({
        where: { id },
        data: {
          name: parsed.data.name,
          email: parsed.data.email.toLowerCase(),
          phone: emptyToNull(parsed.data.phone),
          title: emptyToNull(parsed.data.title),
          active: parsed.data.active,
          roleId: role.id,
          projectAssignments: {
            create: parsed.data.projectIds.map((projectId) => ({ projectId })),
          },
        },
      }),
    ]);
  } catch (error) {
    if (isUniqueConflict(error)) return fail("unique");
    throw error;
  }
  await writeAudit({
    userId: access.session.user.id,
    action: "UPDATE",
    entityType: "User",
    entityId: id,
    summary: `Updated staff ${parsed.data.name} (${role.name})`,
  });
  refresh(["/staff", `/staff/${id}/edit`]);
  return { ok: true as const, id };
}

export async function resolveSyncConflict(conflictId: string, choice: "server" | "local") {
  const access = await guard("sync", "update");
  if (!access.ok) return fail(access.error);
  const result = await forceResolveConflict(access.session.user.id, conflictId, choice);
  if (!result.ok) return fail(result.error);
  refresh(["/sync", "/attendance", "/projects", "/dashboard", "/reports"]);
  return { ok: true as const };
}

export async function syncQueued(input: {
  attendance: AttendanceMutation[];
  assignments: AssignmentMutation[];
}) {
  const access = await guard("sync", "update");
  if (!access.ok) return fail(access.error);
  const attendance = [];
  for (const mutation of input.attendance) {
    const parsed = attendanceRowSchema.safeParse({
      ...mutation,
      note: mutation.note ?? "",
    });
    if (!parsed.success) {
      attendance.push({
        clientMutationId: mutation.clientMutationId,
        result: "rejected" as const,
        message: "Invalid attendance payload.",
      });
      continue;
    }
    const session = await prisma.session.findUnique({
      where: { id: mutation.sessionId },
      include: { cohort: { include: { course: true } } },
    });
    if (session) {
      const allowed = await facilitatorAssigned(
        access.session.user.id,
        access.session.user.role,
        session.cohort.course.projectId,
      );
      if (!allowed) {
        attendance.push({
          clientMutationId: mutation.clientMutationId,
          result: "rejected" as const,
          rule: "NOT_ASSIGNED",
          message: "You are not assigned to this project.",
        });
        continue;
      }
    }
    attendance.push(
      await applyAttendanceMutation(access.session.user.id, {
        ...mutation,
        note: emptyToNull(mutation.note),
        source: "offline",
        status: parsed.data.status,
      }),
    );
  }
  const assignments = [];
  for (const mutation of input.assignments) {
    const parsed = assignmentMutationSchema.safeParse(mutation);
    if (!parsed.success) {
      assignments.push({
        clientMutationId: mutation.clientMutationId,
        result: "rejected" as const,
        message: "Invalid assignment payload.",
      });
      continue;
    }
    assignments.push(
      await applyAssignmentMutation(access.session.user.id, {
        ...parsed.data,
        note: emptyToNull(parsed.data.note),
      }),
    );
  }
  const appliedAttendance = attendance.filter((row) => row.result === "applied").length;
  if (appliedAttendance > 0) {
    await writeAudit({
      userId: access.session.user.id,
      action: "UPDATE",
      entityType: "AttendanceRecord",
      entityId: "offline-sync",
      summary: `Synced ${appliedAttendance} offline attendance marks`,
    });
  }
  refresh(["/sync", "/attendance", "/projects", "/dashboard", "/reports", "/beneficiaries"]);
  return { ok: true as const, attendance, assignments };
}
