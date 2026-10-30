import { PrismaClient, type AttendanceStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ROLE_DETAILS, ROLES } from "../src/lib/rbac";

const prisma = new PrismaClient();

function at(iso: string) {
  return new Date(iso);
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed demo data when NODE_ENV is production.");
  }
  if (process.env.DEMO_LOGIN_ENABLED !== "true") {
    throw new Error("Set DEMO_LOGIN_ENABLED=true in .env.local for the local demo seed.");
  }
  const demoEmail = process.env.DEMO_USER_EMAIL?.trim().toLowerCase();
  const demoPassword = process.env.DEMO_USER_PASSWORD;
  const staffPassword = process.env.DEMO_STAFF_PASSWORD;
  if (!demoEmail || !demoPassword || !staffPassword) {
    throw new Error("Set DEMO_USER_EMAIL, DEMO_USER_PASSWORD, and DEMO_STAFF_PASSWORD in .env.local.");
  }

  const roles = new Map<string, string>();
  for (const key of ROLES) {
    const role = await prisma.role.upsert({
      where: { key },
      update: { name: ROLE_DETAILS[key].name, description: ROLE_DETAILS[key].description },
      create: { key, name: ROLE_DETAILS[key].name, description: ROLE_DETAILS[key].description },
    });
    roles.set(key, role.id);
  }

  const demoHash = await bcrypt.hash(demoPassword, 10);
  const staffHash = await bcrypt.hash(staffPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: demoEmail },
    update: { name: "HT Digital Admin", roleId: roles.get("ADMIN")!, active: true, isDemo: true, passwordHash: demoHash },
    create: {
      email: demoEmail,
      name: "HT Digital Admin",
      passwordHash: demoHash,
      roleId: roles.get("ADMIN")!,
      title: "Program administrator",
      isDemo: true,
    },
  });

  const facilitator = await prisma.user.upsert({
    where: { email: "layla.haddad@example.com" },
    update: { roleId: roles.get("FACILITATOR")!, active: true, isDemo: false },
    create: {
      email: "layla.haddad@example.com",
      name: "Layla Haddad",
      passwordHash: staffHash,
      roleId: roles.get("FACILITATOR")!,
      title: "Community facilitator",
      isDemo: false,
    },
  });

  await prisma.user.upsert({
    where: { email: "nabil.qasem@example.com" },
    update: { roleId: roles.get("VIEWER")!, active: true, isDemo: false },
    create: {
      email: "nabil.qasem@example.com",
      name: "Nabil Qasem",
      passwordHash: staffHash,
      roleId: roles.get("VIEWER")!,
      title: "Reporting viewer",
      isDemo: false,
    },
  });

  const literacy = await prisma.project.upsert({
    where: { code: "HCL-2026" },
    update: {},
    create: {
      code: "HCL-2026",
      name: "Harbor Community Literacy",
      description: "Reading circles for adults in the Cedar District.",
      type: "EDUCATIONAL",
      status: "ACTIVE",
      startDate: at("2026-01-15T00:00:00.000Z"),
      endDate: at("2026-12-15T00:00:00.000Z"),
      location: "Cedar Community Room",
      donor: "Harbor Learning Fund",
      targets: {
        create: [
          { metricKey: "beneficiaries", label: "Learners reached", targetValue: 20, unit: "people" },
          { metricKey: "sessions", label: "Reading sessions", targetValue: 12, unit: "sessions" },
          { metricKey: "attendance_rate", label: "Session attendance", targetValue: 80, unit: "percent" },
        ],
      },
    },
  });

  const wellness = await prisma.project.upsert({
    where: { code: "RWV-2026" },
    update: {},
    create: {
      code: "RWV-2026",
      name: "Riverside Wellness Visits",
      description: "Neighborhood health conversations and mobile clinic days.",
      type: "NON_EDUCATIONAL",
      status: "ACTIVE",
      startDate: at("2026-02-01T00:00:00.000Z"),
      endDate: at("2026-11-30T00:00:00.000Z"),
      location: "Riverside Hall",
      donor: "Civic Wellness Trust",
      targets: {
        create: [
          { metricKey: "beneficiaries", label: "Neighbors reached", targetValue: 15, unit: "people" },
          { metricKey: "activities", label: "Outreach activities", targetValue: 8, unit: "activities" },
          { metricKey: "participation", label: "Participation logs", targetValue: 40, unit: "logs" },
        ],
      },
    },
  });

  await prisma.project.upsert({
    where: { code: "YSE-2026" },
    update: {},
    create: {
      code: "YSE-2026",
      name: "Youth Sports Evenings",
      description: "Draft plan for evening games. No enrollment yet.",
      type: "NON_EDUCATIONAL",
      status: "DRAFT",
      startDate: at("2026-11-01T00:00:00.000Z"),
      location: "East Court",
      targets: {
        create: [{ metricKey: "beneficiaries", label: "Young people registered", targetValue: 30, unit: "people" }],
      },
    },
  });

  for (const projectId of [literacy.id, wellness.id]) {
    await prisma.projectStaff.upsert({
      where: { projectId_userId: { projectId, userId: admin.id } },
      update: {},
      create: { projectId, userId: admin.id },
    });
    await prisma.projectStaff.upsert({
      where: { projectId_userId: { projectId, userId: facilitator.id } },
      update: {},
      create: { projectId, userId: facilitator.id },
    });
  }

  const people = [
    ["BEN-0001", "Omar", "Nasser", "MALE", "HT-1001", "Cedar District"],
    ["BEN-0002", "Hana", "Idris", "FEMALE", "HT-1002", "Cedar District"],
    ["BEN-0003", "Yusuf", "Karim", "MALE", "HT-1003", "North Wharf"],
    ["BEN-0004", "Maya", "Farouk", "FEMALE", "HT-1004", "Cedar District"],
    ["BEN-0005", "Lina", "Saleh", "FEMALE", "HT-1005", "Riverside"],
    ["BEN-0006", "Samir", "Qureshi", "MALE", "HT-1006", "Riverside"],
    ["BEN-0007", "Nora", "Haddad", "FEMALE", "HT-1007", "East Court"],
    ["BEN-0008", "Elias", "Mansour", "MALE", "HT-1008", "North Wharf"],
  ] as const;

  const savedPeople = [];
  for (const [code, firstName, lastName, gender, nationalId, community] of people) {
    const person = await prisma.beneficiary.upsert({
      where: { code },
      update: {},
      create: { code, firstName, lastName, gender, nationalId, community },
    });
    savedPeople.push(person);
  }

  const byCode = Object.fromEntries(savedPeople.map((person) => [person.code, person]));
  const literacyCodes = ["BEN-0001", "BEN-0002", "BEN-0003", "BEN-0004", "BEN-0008"];
  const wellnessCodes = ["BEN-0001", "BEN-0002", "BEN-0005", "BEN-0006", "BEN-0007"];

  for (const code of literacyCodes) {
    await prisma.projectBeneficiary.upsert({
      where: { projectId_beneficiaryId: { projectId: literacy.id, beneficiaryId: byCode[code].id } },
      update: { status: "active" },
      create: { projectId: literacy.id, beneficiaryId: byCode[code].id, status: "active" },
    });
  }
  for (const code of wellnessCodes) {
    await prisma.projectBeneficiary.upsert({
      where: { projectId_beneficiaryId: { projectId: wellness.id, beneficiaryId: byCode[code].id } },
      update: { status: "active" },
      create: { projectId: wellness.id, beneficiaryId: byCode[code].id, status: "active" },
    });
  }

  const course = await prisma.course.upsert({
    where: { projectId_code: { projectId: literacy.id, code: "READ-101" } },
    update: {},
    create: {
      projectId: literacy.id,
      code: "READ-101",
      name: "Foundations of Reading",
      description: "Letters, short words, and shared stories.",
      hours: 36,
    },
  });

  let cohort = await prisma.cohort.findFirst({ where: { courseId: course.id, name: "Morning Circle A" } });
  if (!cohort) {
    cohort = await prisma.cohort.create({
      data: {
        courseId: course.id,
        name: "Morning Circle A",
        startDate: at("2026-09-01T00:00:00.000Z"),
        endDate: at("2026-12-01T00:00:00.000Z"),
        capacity: 16,
        location: "Cedar Community Room",
      },
    });
  }

  for (const code of ["BEN-0001", "BEN-0002", "BEN-0003", "BEN-0004"]) {
    await prisma.cohortEnrollment.upsert({
      where: { cohortId_beneficiaryId: { cohortId: cohort.id, beneficiaryId: byCode[code].id } },
      update: { status: "active" },
      create: { cohortId: cohort.id, beneficiaryId: byCode[code].id, status: "active" },
    });
  }

  const sessionPlan = [
    ["Letters and sounds", "2026-09-02T09:00:00.000Z"],
    ["Short words", "2026-09-09T09:00:00.000Z"],
    ["Reading together", "2026-09-16T09:00:00.000Z"],
    ["Story circle", "2026-10-07T09:00:00.000Z"],
  ] as const;

  const sessions = [];
  for (const [title, when] of sessionPlan) {
    let session = await prisma.session.findFirst({ where: { cohortId: cohort.id, title } });
    if (!session) {
      session = await prisma.session.create({
        data: {
          cohortId: cohort.id,
          title,
          scheduledAt: at(when),
          durationMin: 90,
          location: "Cedar Community Room",
          facilitatorId: facilitator.id,
        },
      });
    }
    sessions.push(session);
  }

  const marks: Record<string, AttendanceStatus[]> = {
    "BEN-0001": ["PRESENT", "PRESENT", "LATE", "PRESENT"],
    "BEN-0002": ["PRESENT", "ABSENT", "PRESENT", "PRESENT"],
    "BEN-0003": ["LATE", "PRESENT", "PRESENT", "EXCUSED"],
    "BEN-0004": ["PRESENT", "PRESENT", "ABSENT", "PRESENT"],
  };
  for (const [code, statuses] of Object.entries(marks)) {
    for (let index = 0; index < sessions.length; index += 1) {
      const session = sessions[index];
      const recordedAt = new Date(session.scheduledAt.getTime() + 20 * 60 * 1000);
      await prisma.attendanceRecord.upsert({
        where: { sessionId_beneficiaryId: { sessionId: session.id, beneficiaryId: byCode[code].id } },
        update: {},
        create: {
          sessionId: session.id,
          beneficiaryId: byCode[code].id,
          status: statuses[index],
          recordedAt,
          takenById: facilitator.id,
          source: "server",
        },
      });
    }
  }

  const activityNames = [
    ["Saturday clinic", "2026-09-06T10:00:00.000Z"],
    ["Nutrition conversation", "2026-09-20T16:00:00.000Z"],
  ] as const;
  for (const [name, when] of activityNames) {
    let activity = await prisma.activity.findFirst({ where: { projectId: wellness.id, name } });
    if (!activity) {
      activity = await prisma.activity.create({
        data: { projectId: wellness.id, name, scheduledAt: at(when), location: "Riverside Hall" },
      });
    }
    for (const code of wellnessCodes.slice(0, 4)) {
      await prisma.participationLog.upsert({
        where: { activityId_beneficiaryId: { activityId: activity.id, beneficiaryId: byCode[code].id } },
        update: {},
        create: { activityId: activity.id, beneficiaryId: byCode[code].id, participated: code !== "BEN-0006" },
      });
    }
  }

  const existingAudit = await prisma.auditLog.count();
  if (existingAudit === 0) {
    await prisma.auditLog.createMany({
      data: [
        {
          userId: admin.id,
          action: "CREATE",
          entityType: "Project",
          entityId: literacy.id,
          summary: "Created project HCL-2026 · Harbor Community Literacy",
        },
        {
          userId: admin.id,
          action: "CREATE",
          entityType: "Beneficiary",
          entityId: byCode["BEN-0001"].id,
          summary: "Registered beneficiary BEN-0001 · Omar Nasser",
        },
        {
          userId: facilitator.id,
          action: "UPDATE",
          entityType: "AttendanceRecord",
          entityId: sessions[0].id,
          summary: "Updated attendance for Morning Circle A",
        },
      ],
    });
  }

  console.log("Demo data is ready.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
