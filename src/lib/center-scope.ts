import { cache } from "react";
import { rawPrisma } from "@/lib/prisma";

// Read the current assignment from the database, including during queued sync.
// A center or role change must take effect without waiting for a JWT refresh.
export const currentActor = cache(async () => {
  const { auth } = await import("@/auth");
  const session = await auth();
  if (!session?.user?.id) return null;
  return rawPrisma.user.findUnique({ where: { id: session.user.id }, include: { role: true } });
});

export async function centerScope() {
  const actor = await currentActor();
  if (!actor?.active) throw new Error("Authentication required");
  if (actor.role.key === "ADMIN") return null;
  if (actor.centerId || actor.role.key === "CENTER_MANAGER") {
    return { centerId: actor.centerId ?? "__unassigned__", userId: actor.id };
  }
  return null;
}

export function scopeFilter(model: string, scope: { centerId: string; userId: string }): Record<string, unknown> | null {
  const { centerId, userId } = scope;
  const project = { centers: { some: { centerId } } };
  const person = { centerId };
  switch (model) {
    case "Center": return { id: centerId };
    case "CenterProject": return { centerId };
    case "Project": return project;
    case "ProjectTarget": return { project };
    case "Beneficiary": return person;
    case "Course": return { project };
    case "Cohort": return { centerId };
    case "Session": return { cohort: { centerId } };
    case "Activity": return { centerId };
    case "AttendanceRecord": return { session: { cohort: { centerId } } };
    case "ParticipationLog": return { activity: { centerId }, beneficiary: person };
    case "CohortEnrollment": return { cohort: { centerId }, beneficiary: person };
    case "ProjectBeneficiary": return { beneficiary: person, project };
    case "User": return { OR: [{ centerId }, { id: userId }] };
    case "ProjectStaff": return { user: { centerId }, project };
    case "AuditLog": return { userId };
    case "SyncConflict": return { userId };
    case "CenterTransfer": return { OR: [{ fromCenterId: centerId }, { toCenterId: centerId, status: "APPROVED" }] };
    default: return null;
  }
}

export async function deliveryCenter(requested: string | undefined, projectId?: string) {
  const scope = await centerScope();
  if (scope && requested && requested !== scope.centerId) return { ok: false as const };
  const centerId = scope?.centerId ?? requested ?? "";
  if (!centerId) return { ok: true as const, centerId: null };
  const center = await rawPrisma.center.findFirst({ where: { id: centerId, active: true } });
  if (!center) return { ok: false as const };
  if (projectId && !await rawPrisma.centerProject.findUnique({ where: { centerId_projectId: { centerId, projectId } } })) {
    return { ok: false as const };
  }
  return { ok: true as const, centerId };
}
