import { currentActor } from "@/lib/center-scope";
import { can } from "@/lib/rbac";
import { facilitatorAssigned } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import {
  resolveAssignment,
  resolveAttendance,
  type AssignmentLocal,
  type AttendanceStatus,
} from "@/lib/sync/rules";

export type AttendanceMutation = {
  sessionId: string;
  beneficiaryId: string;
  status: AttendanceStatus;
  note: string | null;
  recordedAt: string;
  baseUpdatedAt: string | null;
  clientMutationId: string;
  source: "server" | "offline";
};

export type AssignmentMutation = {
  projectId: string;
  beneficiaryId: string;
  op: "ASSIGN" | "WITHDRAW";
  note: string | null;
  baseUpdatedAt: string | null;
  baseNotes: string | null;
  clientMutationId: string;
};

export type MutationResult = {
  clientMutationId: string;
  result: "applied" | "noop" | "rejected" | "conflict";
  rule?: string;
  message: string;
  conflictId?: string;
};

async function holdConflict(input: {
  entityType: string;
  entityKey: string;
  rule: string;
  message: string;
  localPayload: unknown;
  serverPayload: unknown;
  userId: string;
}) {
  const pending = await prisma.syncConflict.findFirst({
    where: { entityKey: input.entityKey, status: "pending" },
  });
  if (pending) {
    return pending.id;
  }
  const created = await prisma.syncConflict.create({
    data: {
      entityType: input.entityType,
      entityKey: input.entityKey,
      rule: input.rule,
      message: input.message,
      localPayload: input.localPayload as object,
      serverPayload: (input.serverPayload ?? undefined) as object | undefined,
      userId: input.userId,
    },
  });
  return created.id;
}

export async function applyAttendanceMutation(
  userId: string,
  mutation: AttendanceMutation,
): Promise<MutationResult> {
  const actor = await currentActor();
  if (!actor?.active || actor.id !== userId || !can(actor.role.key, "attendance", "update")) return { clientMutationId: mutation.clientMutationId, result: "rejected", rule: "FORBIDDEN", message: "Attendance permission is required." };
  const session = await prisma.session.findUnique({
    where: { id: mutation.sessionId },
    include: {
      cohort: { include: { course: true, enrollments: true } },
      attendance: true,
    },
  });

  if (session && !await facilitatorAssigned(userId, actor.role.key, session.cohort.course.projectId)) return { clientMutationId: mutation.clientMutationId, result: "rejected", rule: "FORBIDDEN", message: "Project assignment is required." };
  const local = {
    status: mutation.status,
    note: mutation.note,
    recordedAt: mutation.recordedAt,
    baseUpdatedAt: mutation.baseUpdatedAt,
  };

  if (!session) {
    const decision = resolveAttendance(local, null, {
      exists: false,
      scheduledAt: new Date(0).toISOString(),
      durationMin: 0,
    });
    const conflictId = await holdConflict({
      entityType: "attendance",
      entityKey: `attendance:${mutation.sessionId}:${mutation.beneficiaryId}`,
      rule: decision.type === "conflict" ? decision.rule : "ATTENDANCE_SESSION_MISSING",
      message: decision.reason,
      localPayload: mutation,
      serverPayload: null,
      userId,
    });
    return {
      clientMutationId: mutation.clientMutationId,
      result: "conflict",
      rule: "ATTENDANCE_SESSION_MISSING",
      message: decision.reason,
      conflictId,
    };
  }

  const person = await prisma.beneficiary.findUnique({ where: { id: mutation.beneficiaryId } });
  if (!person || person.centerId !== session.cohort.centerId) return { clientMutationId: mutation.clientMutationId, result: "rejected", rule: "CENTER_CHANGED", message: "The beneficiary or session center has changed." };
  const enrolled = session.cohort.enrollments.some(
    (row) => row.beneficiaryId === mutation.beneficiaryId && row.status === "active",
  );
  if (!enrolled) {
    return {
      clientMutationId: mutation.clientMutationId,
      result: "rejected",
      rule: "ENROLLMENT_MISSING",
      message: "This person is not enrolled in the class.",
    };
  }

  const current = session.attendance.find((row) => row.beneficiaryId === mutation.beneficiaryId) ?? null;
  const decision = resolveAttendance(
    local,
    current
      ? {
          status: current.status,
          note: current.note,
          recordedAt: current.recordedAt.toISOString(),
          updatedAt: current.updatedAt.toISOString(),
        }
      : null,
    {
      exists: true,
      scheduledAt: session.scheduledAt.toISOString(),
      durationMin: session.durationMin,
    },
  );

  if (decision.type === "noop") {
    return { clientMutationId: mutation.clientMutationId, result: "noop", message: decision.reason };
  }

  if (decision.type === "reject") {
    return {
      clientMutationId: mutation.clientMutationId,
      result: "rejected",
      rule: decision.rule,
      message: decision.reason,
    };
  }

  if (decision.type === "conflict") {
    const conflictId = await holdConflict({
      entityType: "attendance",
      entityKey: `attendance:${mutation.sessionId}:${mutation.beneficiaryId}`,
      rule: decision.rule,
      message: decision.reason,
      localPayload: mutation,
      serverPayload: current,
      userId,
    });
    return {
      clientMutationId: mutation.clientMutationId,
      result: "conflict",
      rule: decision.rule,
      message: decision.reason,
      conflictId,
    };
  }

  const recordedAt = new Date(mutation.recordedAt);
  await prisma.attendanceRecord.upsert({
    where: {
      sessionId_beneficiaryId: {
        sessionId: mutation.sessionId,
        beneficiaryId: mutation.beneficiaryId,
      },
    },
    create: {
      sessionId: mutation.sessionId,
      beneficiaryId: mutation.beneficiaryId,
      status: mutation.status,
      note: mutation.note,
      recordedAt,
      takenById: userId,
      source: mutation.source,
      clientId: mutation.clientMutationId,
    },
    update: {
      status: mutation.status,
      note: mutation.note,
      recordedAt,
      takenById: userId,
      source: mutation.source,
      clientId: mutation.clientMutationId,
    },
  });

  return { clientMutationId: mutation.clientMutationId, result: "applied", message: decision.reason };
}

export async function applyAssignmentMutation(
  userId: string,
  mutation: AssignmentMutation,
): Promise<MutationResult> {
  const actor = await currentActor();
  if (!actor?.active || actor.id !== userId || (!can(actor.role.key, "assignments", "update") && !can(actor.role.key, "cohorts", "update"))) return { clientMutationId: mutation.clientMutationId, result: "rejected", rule: "FORBIDDEN", message: "Beneficiary assignment permission is required." };
  const [project, beneficiary] = await Promise.all([
    prisma.project.findUnique({ where: { id: mutation.projectId } }),
    prisma.beneficiary.findUnique({ where: { id: mutation.beneficiaryId } }),
  ]);

  if (!project || !beneficiary) {
    return {
      clientMutationId: mutation.clientMutationId,
      result: "rejected",
      rule: !beneficiary ? "BENEFICIARY_MISSING" : "PROJECT_MISSING",
      message: "The project or beneficiary record was not found. No duplicate person was created.",
    };
  }

  if (beneficiary.centerId && !await prisma.centerProject.findUnique({ where: { centerId_projectId: { centerId: beneficiary.centerId, projectId: mutation.projectId } } })) {
    return { clientMutationId: mutation.clientMutationId, result: "rejected", rule: "CENTER_PROJECT_MISMATCH", message: "This project is not available at the beneficiary's center." };
  }
  const current = await prisma.projectBeneficiary.findUnique({
    where: {
      projectId_beneficiaryId: {
        projectId: mutation.projectId,
        beneficiaryId: mutation.beneficiaryId,
      },
    },
  });

  const local: AssignmentLocal = {
    op: mutation.op,
    note: mutation.note,
    baseUpdatedAt: mutation.baseUpdatedAt,
    baseNotes: mutation.baseNotes,
  };
  const decision = resolveAssignment(
    local,
    current
      ? {
          status: current.status,
          notes: current.notes,
          updatedAt: current.updatedAt.toISOString(),
        }
      : null,
  );

  if (decision.type === "noop") {
    return { clientMutationId: mutation.clientMutationId, result: "noop", message: decision.reason };
  }
  if (decision.type === "reject") {
    return {
      clientMutationId: mutation.clientMutationId,
      result: "rejected",
      rule: decision.rule,
      message: decision.reason,
    };
  }
  if (decision.type === "conflict") {
    const conflictId = await holdConflict({
      entityType: "project_assignment",
      entityKey: `assignment:${mutation.projectId}:${mutation.beneficiaryId}`,
      rule: decision.rule,
      message: decision.reason,
      localPayload: mutation,
      serverPayload: current,
      userId,
    });
    return {
      clientMutationId: mutation.clientMutationId,
      result: "conflict",
      rule: decision.rule,
      message: decision.reason,
      conflictId,
    };
  }

  if (mutation.op === "ASSIGN") {
    await prisma.projectBeneficiary.upsert({
      where: {
        projectId_beneficiaryId: {
          projectId: mutation.projectId,
          beneficiaryId: mutation.beneficiaryId,
        },
      },
      create: {
        projectId: mutation.projectId,
        beneficiaryId: mutation.beneficiaryId,
        status: "active",
        notes: mutation.note,
      },
      update: {
        status: "active",
        notes: mutation.note ?? current?.notes,
      },
    });
  } else if (current) {
    await prisma.projectBeneficiary.update({
      where: { id: current.id },
      data: { status: "withdrawn" },
    });
  }

  await writeAudit({
    userId,
    action: mutation.op === "ASSIGN" ? "CREATE" : "UPDATE",
    entityType: "ProjectBeneficiary",
    entityId: `${mutation.projectId}:${mutation.beneficiaryId}`,
    summary:
      mutation.op === "ASSIGN"
        ? `Assigned ${beneficiary.firstName} ${beneficiary.lastName} to ${project.name}`
        : `Withdrew ${beneficiary.firstName} ${beneficiary.lastName} from ${project.name}`,
  });

  return { clientMutationId: mutation.clientMutationId, result: "applied", message: decision.reason };
}

export async function forceResolveConflict(userId: string, conflictId: string, choice: "server" | "local") {
  const conflict = await prisma.syncConflict.findUnique({ where: { id: conflictId } });
  if (!conflict || conflict.status !== "pending") {
    return { ok: false as const, error: "notFound" as const };
  }

  if (choice === "local") {
    if (conflict.entityType === "attendance") {
      const payload = conflict.localPayload as AttendanceMutation;
      const session = await prisma.session.findUnique({ where: { id: payload.sessionId } });
      if (!session) return { ok: false as const, error: "notFound" as const };
      const person = await prisma.beneficiary.findUnique({ where: { id: payload.beneficiaryId } });
      const cohort = await prisma.cohort.findUnique({ where: { id: session.cohortId } });
      const enrolled = await prisma.cohortEnrollment.findFirst({ where: { cohortId: session.cohortId, beneficiaryId: payload.beneficiaryId, status: "active" } });
      if (!person || !cohort || person.centerId !== cohort.centerId || !enrolled) return { ok: false as const, error: "forbidden" as const };
      await prisma.attendanceRecord.upsert({
        where: {
          sessionId_beneficiaryId: {
            sessionId: payload.sessionId,
            beneficiaryId: payload.beneficiaryId,
          },
        },
        create: {
          sessionId: payload.sessionId,
          beneficiaryId: payload.beneficiaryId,
          status: payload.status,
          note: payload.note,
          recordedAt: new Date(payload.recordedAt),
          takenById: userId,
          source: "offline",
          clientId: payload.clientMutationId,
        },
        update: {
          status: payload.status,
          note: payload.note,
          recordedAt: new Date(payload.recordedAt),
          takenById: userId,
          source: "offline",
          clientId: payload.clientMutationId,
        },
      });
    } else {
      const payload = conflict.localPayload as AssignmentMutation;
      const person = await prisma.beneficiary.findUnique({ where: { id: payload.beneficiaryId } });
      const project = await prisma.project.findUnique({ where: { id: payload.projectId } });
      if (!person || !project || (person.centerId && !await prisma.centerProject.findUnique({ where: { centerId_projectId: { centerId: person.centerId, projectId: project.id } } }))) return { ok: false as const, error: "forbidden" as const };
      if (payload.op === "ASSIGN") {
        await prisma.projectBeneficiary.upsert({
          where: {
            projectId_beneficiaryId: {
              projectId: payload.projectId,
              beneficiaryId: payload.beneficiaryId,
            },
          },
          create: {
            projectId: payload.projectId,
            beneficiaryId: payload.beneficiaryId,
            status: "active",
            notes: payload.note,
          },
          update: { status: "active", notes: payload.note },
        });
      } else {
        await prisma.projectBeneficiary.updateMany({
          where: { projectId: payload.projectId, beneficiaryId: payload.beneficiaryId },
          data: { status: "withdrawn" },
        });
      }
    }
  }

  await prisma.syncConflict.update({
    where: { id: conflict.id },
    data: {
      status: choice === "local" ? "kept_local" : "kept_server",
      resolvedAt: new Date(),
      resolvedById: userId,
    },
  });

  await writeAudit({
    userId,
    action: "UPDATE",
    entityType: "SyncConflict",
    entityId: conflict.id,
    summary: choice === "local" ? "Kept the field version of a sync conflict" : "Kept the server version of a sync conflict",
    changes: { rule: conflict.rule, choice },
  });

  return { ok: true as const };
}
