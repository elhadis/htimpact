import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { can, type PermissionAction, type Resource } from "@/lib/rbac";

export async function guard(resource: Resource, action: PermissionAction) {
  const session = await auth();
  if (!session?.user?.id || session.user.active === false) {
    return { ok: false as const, error: "auth" as const, session: null };
  }
  if (!can(session.user.role, resource, action)) {
    return { ok: false as const, error: "forbidden" as const, session };
  }
  return { ok: true as const, error: null, session };
}

export async function facilitatorAssigned(userId: string, role: string, projectId: string) {
  if (role !== "FACILITATOR") return true;
  const link = await prisma.projectStaff.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  return Boolean(link);
}
