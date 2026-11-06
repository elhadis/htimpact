"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { guard } from "@/lib/guard";
import { prisma, rawPrisma } from "@/lib/prisma";
import { centerSchema, transferSchema } from "@/lib/validators";
import { writeAudit } from "@/lib/audit";

function refresh() {
  for (const locale of ["ar", "en"]) revalidatePath(`/${locale}`, "layout");
}
async function serializable<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await rawPrisma.$transaction(work, { isolationLevel: "Serializable" }); }
    catch (error) {
      if (attempt >= 2 || !(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2034") throw error;
    }
  }
}

export async function saveCenter(input: unknown) {
  const access = await guard("centers", "create");
  if (!access.ok || access.session.user.role !== "ADMIN") return { ok: false as const, error: "forbidden" };
  const parsed = centerSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "invalid" };
  const data = parsed.data;
  const projectIds = [...new Set(data.projectIds)];
  const managerIds = [...new Set(data.managerIds)];
  const [projects, managers] = await Promise.all([
    prisma.project.count({ where: { id: { in: projectIds } } }),
    prisma.user.findMany({ where: { id: { in: managerIds }, active: true, role: { key: "CENTER_MANAGER" } } }),
  ]);
  if (projects !== projectIds.length || managers.length !== managerIds.length || managers.some((manager) => manager.centerId && manager.centerId !== data.id)) {
    return { ok: false as const, error: "invalid" };
  }
  try {
    const center = await serializable(async (tx) => {
      const existing = data.id ? await tx.center.findUnique({ where: { id: data.id } }) : null;
      const saved = existing
        ? await tx.center.update({ where: { id: existing.id }, data: { code: data.code.toUpperCase(), name: data.name, location: data.location || null, active: data.active } })
        : await tx.center.create({ data: { ...(data.id ? { id: data.id } : {}), code: data.code.toUpperCase(), name: data.name, location: data.location || null, active: data.active } });
      await tx.centerProject.deleteMany({ where: { centerId: saved.id, projectId: { notIn: projectIds } } });
      for (const projectId of projectIds) await tx.centerProject.upsert({ where: { centerId_projectId: { centerId: saved.id, projectId } }, create: { centerId: saved.id, projectId }, update: {} });
      await tx.user.updateMany({ where: { centerId: saved.id, role: { key: "CENTER_MANAGER" }, id: { notIn: managerIds } }, data: { centerId: null } });
      // A manager cannot be silently reassigned from another center by this form.
      const assigned = await tx.user.updateMany({ where: { id: { in: managerIds }, OR: [{ centerId: null }, { centerId: saved.id }], role: { key: "CENTER_MANAGER" } }, data: { centerId: saved.id } });
      if (assigned.count !== managerIds.length) throw new Error("Manager assignment changed. Reload the form.");
      return saved;
    });
    await writeAudit({ userId: access.session.user.id, action: "UPDATE", entityType: "Center", entityId: center.id, summary: `Saved center ${center.code} · ${center.name}` });
    refresh();
    return { ok: true as const, id: center.id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { ok: false as const, error: "unique" };
    throw error;
  }
}

export async function requestTransfer(input: unknown) {
  const access = await guard("transfers", "create");
  if (!access.ok) return { ok: false as const, error: access.error };
  const parsed = transferSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "invalid" };
  const data = parsed.data;
  const person = await prisma.beneficiary.findUnique({ where: { id: data.beneficiaryId } });
  if (!person || !person.centerId || person.centerId !== data.fromCenterId || data.fromCenterId === data.toCenterId) return { ok: false as const, error: "invalid" };
  const destination = await rawPrisma.center.findFirst({ where: { id: data.toCenterId, active: true } });
  if (!destination) return { ok: false as const, error: "invalid" };
  const result = await serializable(async (tx) => {
    const previous = await tx.centerTransfer.findUnique({ where: { id: data.id } });
    if (previous) return { ok: previous.requestedById === access.session.user.id && previous.beneficiaryId === person.id && previous.toCenterId === data.toCenterId };
    const current = await tx.beneficiary.findUnique({ where: { id: person.id } });
    if (current?.centerId !== data.fromCenterId) return { ok: false };
    if (await tx.centerTransfer.findFirst({ where: { beneficiaryId: person.id, status: "PENDING" } })) return { ok: false };
    await tx.centerTransfer.create({ data: { ...data, requestedById: access.session.user.id } });
    return { ok: true };
  });
  if (!result.ok) return { ok: false as const, error: "transferPending" };
  await writeAudit({ userId: access.session.user.id, action: "CREATE", entityType: "CenterTransfer", entityId: data.id, summary: `Requested center transfer for ${person.code}` });
  refresh();
  return { ok: true as const, id: data.id };
}

export async function reviewTransfer(id: string, approve: boolean) {
  const access = await guard("transfers", "update");
  if (!access.ok || access.session.user.role !== "ADMIN") return { ok: false as const, error: "forbidden" };
  const result = await serializable(async (tx) => {
    const transfer = await tx.centerTransfer.findUnique({ where: { id }, include: { toCenter: true } });
    if (!transfer) return false;
    if (transfer.status !== "PENDING") return transfer.status === (approve ? "APPROVED" : "REJECTED");
    if (approve) {
      if (!transfer.toCenter.active) return false;
      const moved = await tx.beneficiary.updateMany({ where: { id: transfer.beneficiaryId, centerId: transfer.fromCenterId }, data: { centerId: transfer.toCenterId } });
      if (moved.count !== 1) return false;
      // Preserve all historical records; close old active enrollments only.
      await tx.cohortEnrollment.updateMany({ where: { beneficiaryId: transfer.beneficiaryId, status: "active", cohort: { centerId: transfer.fromCenterId } }, data: { status: "withdrawn" } });
      const destinationProjects = await tx.centerProject.findMany({ where: { centerId: transfer.toCenterId } });
      await tx.projectBeneficiary.updateMany({ where: { beneficiaryId: transfer.beneficiaryId, status: "active", projectId: { notIn: destinationProjects.map((row) => row.projectId) } }, data: { status: "withdrawn" } });
    }
    await tx.centerTransfer.update({ where: { id }, data: { status: approve ? "APPROVED" : "REJECTED", reviewedById: access.session.user.id, reviewedAt: new Date() } });
    await tx.auditLog.create({ data: { userId: access.session.user.id, action: "UPDATE", entityType: "CenterTransfer", entityId: id, summary: `${approve ? "Approved" : "Rejected"} center transfer`, changes: { beneficiaryId: transfer.beneficiaryId, fromCenterId: transfer.fromCenterId, toCenterId: transfer.toCenterId } } });
    return true;
  });
  if (!result) return { ok: false as const, error: "transferChanged" };
  refresh();
  return { ok: true as const };
}
