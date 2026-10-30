import { prisma } from "@/lib/prisma";
import type { AuditAction, Prisma } from "@prisma/client";

export async function writeAudit(input: {
  userId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  summary: string;
  changes?: Prisma.InputJsonValue;
}) {
  await prisma.auditLog.create({
    data: {
      userId: input.userId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      summary: input.summary,
      changes: input.changes,
    },
  });
}
