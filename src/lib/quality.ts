import "server-only";
import { prisma } from "@/lib/prisma";
import { missingAttendance, possibleDuplicates } from "@/lib/quality-rules";

export async function qualityData() {
  const now = new Date();
  const [people, sessions, transfers, conflictCount] = await Promise.all([
    prisma.beneficiary.findMany({
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, code: true, firstName: true, lastName: true, centerId: true, dateOfBirth: true, phone: true, projects: { where: { status: { not: "withdrawn" } }, select: { id: true } } },
    }),
    prisma.session.findMany({
      where: { scheduledAt: { lte: now } }, orderBy: { scheduledAt: "desc" },
      select: {
        id: true, title: true, scheduledAt: true, durationMin: true,
        cohort: { select: { name: true, enrollments: { where: { status: "active" }, select: { beneficiaryId: true, enrolledAt: true } } } },
        attendance: { select: { beneficiaryId: true } },
      },
    }),
    prisma.centerTransfer.findMany({
      where: { status: "PENDING" }, orderBy: { createdAt: "asc" },
      select: { id: true, createdAt: true, beneficiary: { select: { code: true, firstName: true, lastName: true } }, fromCenter: { select: { name: true } }, toCenter: { select: { name: true } } },
    }),
    prisma.syncConflict.count({ where: { status: "pending" } }),
  ]);
  const personLabel = (person: (typeof people)[number]) => ({ id: person.id, code: person.code, name: `${person.firstName} ${person.lastName}` });
  return {
    capturedAt: new Date().toISOString(),
    missingCenter: people.filter((person) => !person.centerId).map(personLabel),
    missingProject: people.filter((person) => person.projects.length === 0).map(personLabel),
    incompleteAttendance: sessions.flatMap((session) => {
      const missing = missingAttendance(session, now);
      return missing ? [{ id: session.id, title: session.title, cohort: session.cohort.name, scheduledAt: session.scheduledAt.toISOString(), missing }] : [];
    }),
    transfers: transfers.map((row) => ({ id: row.id, person: `${row.beneficiary.code} · ${row.beneficiary.firstName} ${row.beneficiary.lastName}`, from: row.fromCenter.name, to: row.toCenter.name, createdAt: row.createdAt.toISOString() })),
    duplicates: possibleDuplicates(people),
    conflictCount,
  };
}
export type QualityData = Awaited<ReturnType<typeof qualityData>>;
