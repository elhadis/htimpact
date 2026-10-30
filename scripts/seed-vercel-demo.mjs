import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const date = (day) => new Date(day + "T09:00:00.000Z");

async function main() {
  if (process.env.VERCEL_ENV !== "production" || process.env.DEMO_SEED_ENABLED !== "true") {
    console.log("Demo content skipped (requires Vercel production and DEMO_SEED_ENABLED=true).");
    return;
  }
  const existingProjects = await prisma.project.count();
  const existingBeneficiaries = await prisma.beneficiary.count();
  if (existingProjects > 0 || existingBeneficiaries > 0) {
    console.log("Demo content skipped: database already contains projects or beneficiaries.");
    return;
  }

  const definitions = [
    { code: "DEMO-EDU", name: "Digital Education for Children", type: "EDUCATIONAL", location: "Kampala Learning Center", course: "Digital Literacy Basics", courseCode: "DIG-101", target: 150 },
    { code: "DEMO-YOUTH", name: "Youth Vocational Training", type: "EDUCATIONAL", location: "Kampala Skills Hub", course: "Introduction to Computer Skills", courseCode: "SKL-101", target: 100 },
    { code: "DEMO-LIFE", name: "Livelihood Support", type: "NON_EDUCATIONAL", location: "Kampala Community Hall", activity: "Small Business Workshop", target: 120 },
    { code: "DEMO-COMM", name: "Community Awareness", type: "NON_EDUCATIONAL", location: "Kampala Outreach Center", activity: "Community Information Session", target: 200 },
    { code: "DEMO-PROT", name: "Child Protection", type: "NON_EDUCATIONAL", location: "Kampala Family Center", activity: "Child Safety Awareness", target: 80 },
  ];

  const projects = [];
  for (const def of definitions) {
    projects.push(await prisma.project.upsert({
      where: { code: def.code },
      update: {},
      create: {
        code: def.code, name: def.name, type: def.type, status: "ACTIVE",
        description: "Illustrative demonstration project. All records are fictional.",
        startDate: date("2026-01-05"), endDate: date("2026-12-20"),
        location: def.location, donor: "Demo funding partner (fictional)",
        targets: { create: [{ metricKey: "beneficiaries", label: "People reached", targetValue: def.target, unit: "people" }] },
      },
    }));
  }

  const firstNames = ["Amina", "Omar", "Sara", "Musa", "Fatima", "Yusuf", "Hana", "Adam", "Lina", "Khalid", "Mariam", "Ali", "Nadia", "Samir", "Huda", "Tariq", "Salma", "Ibrahim", "Rania", "Bilal", "Dina", "Hassan", "Leila", "Karim"];
  const people = [];
  for (let i = 0; i < firstNames.length; i++) {
    const code = "DEMO-BEN-" + String(i + 1).padStart(3, "0");
    const person = await prisma.beneficiary.upsert({
      where: { code }, update: {},
      create: { code, firstName: firstNames[i], lastName: "Demo" + String(i + 1), gender: i % 2 ? "MALE" : "FEMALE", community: "Kampala (fictional)", notes: "Synthetic demonstration record; not a real person." },
    });
    people.push(person);
    for (let p = 0; p < projects.length; p++) {
      if ((i + p) % 3 === 0 || (p === 0 && i < 16)) {
        await prisma.projectBeneficiary.upsert({
          where: { projectId_beneficiaryId: { projectId: projects[p].id, beneficiaryId: person.id } },
          update: {}, create: { projectId: projects[p].id, beneficiaryId: person.id, status: "active" },
        });
      }
    }
  }

  for (let p = 0; p < definitions.length; p++) {
    const def = definitions[p];
    const project = projects[p];
    if (def.type === "EDUCATIONAL") {
      const course = await prisma.course.upsert({
        where: { projectId_code: { projectId: project.id, code: def.courseCode } },
        update: {},
        create: { projectId: project.id, code: def.courseCode, name: def.course, description: "Practical introductory learning programme (demo).", hours: 24 },
      });
      let cohort = await prisma.cohort.findFirst({ where: { courseId: course.id, name: "Morning Group A" } });
      if (!cohort) cohort = await prisma.cohort.create({
        data: { courseId: course.id, name: "Morning Group A", startDate: date("2026-09-01"), endDate: date("2026-12-15"), capacity: 24, location: def.location },
      });
      const enrolled = people.filter((_, i) => p === 0 ? i < 16 : i >= 8);
      for (const person of enrolled) {
        await prisma.cohortEnrollment.upsert({
          where: { cohortId_beneficiaryId: { cohortId: cohort.id, beneficiaryId: person.id } },
          update: {}, create: { cohortId: cohort.id, beneficiaryId: person.id, status: "active" },
        });
        await prisma.projectBeneficiary.upsert({
          where: { projectId_beneficiaryId: { projectId: project.id, beneficiaryId: person.id } },
          update: {}, create: { projectId: project.id, beneficiaryId: person.id, status: "active" },
        });
      }
      for (let s = 0; s < 5; s++) {
        const title = ["Orientation", "Introduction to Devices", "Digital Skills Practice", "Collaborative Learning", "Skills Review"][s];
        let session = await prisma.session.findFirst({ where: { cohortId: cohort.id, title } });
        if (!session) session = await prisma.session.create({
          data: { cohortId: cohort.id, title, scheduledAt: date("2026-10-" + String(5 + s * 4).padStart(2, "0")), durationMin: 90, location: def.location },
        });
        for (let i = 0; i < enrolled.length; i++) {
          const status = (i + s) % 9 === 0 ? "ABSENT" : (i + s) % 7 === 0 ? "LATE" : "PRESENT";
          await prisma.attendanceRecord.upsert({
            where: { sessionId_beneficiaryId: { sessionId: session.id, beneficiaryId: enrolled[i].id } },
            update: {}, create: { sessionId: session.id, beneficiaryId: enrolled[i].id, status, source: "demo" },
          });
        }
      }
    } else {
      let activity = await prisma.activity.findFirst({ where: { projectId: project.id, name: def.activity } });
      if (!activity) activity = await prisma.activity.create({
        data: { projectId: project.id, name: def.activity, description: "Illustrative outreach activity.", scheduledAt: date("2026-10-20"), location: def.location },
      });
      for (let i = 0; i < people.length; i++) {
        if ((i + p) % 3 === 0) await prisma.participationLog.upsert({
          where: { activityId_beneficiaryId: { activityId: activity.id, beneficiaryId: people[i].id } },
          update: {}, create: { activityId: activity.id, beneficiaryId: people[i].id, participated: i % 6 !== 0 },
        });
      }
    }
  }
  console.log("Synthetic demo projects, courses, cohorts, sessions, beneficiaries, attendance and activities created.");
}

main().catch((error) => { console.error("Demo seed failed:", error); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
