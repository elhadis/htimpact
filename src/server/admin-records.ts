"use server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { guard } from "@/lib/guard";
import { rawPrisma } from "@/lib/prisma";
import { courseSchema } from "@/lib/validators";
import { updateProject, updateBeneficiary } from "@/server/mutations";

const operationSchema = z.object({ kind: z.enum(["delete", "update"]), entity: z.enum(["beneficiaries", "projects", "courses"]), entityId: z.string().min(1), baseUpdatedAt: z.string().datetime(), values: z.unknown().optional() });
function refresh() { for (const locale of ["en", "ar"]) revalidatePath(`/${locale}`, "layout"); }
export async function applyAdminOperation(input: unknown) {
  const parsed = operationSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "invalid" };
  const op = parsed.data;
  const access = await guard(op.entity, op.kind === "delete" ? "delete" : "update");
  if (!access.ok || access.session.user.role !== "ADMIN") return { ok: false as const, error: "forbidden" };
  if (op.kind === "update") {
    const current = op.entity === "beneficiaries" ? await rawPrisma.beneficiary.findUnique({ where: { id: op.entityId } }) : op.entity === "projects" ? await rawPrisma.project.findUnique({ where: { id: op.entityId } }) : await rawPrisma.course.findUnique({ where: { id: op.entityId } });
    if (!current) return { ok: false as const, error: "notFound" };
    if (current.updatedAt.toISOString() !== op.baseUpdatedAt) return { ok: false as const, error: "staleRecord" };
    if (op.entity === "beneficiaries") return updateBeneficiary(op.entityId, op.values);
    if (op.entity === "projects") return updateProject(op.entityId, op.values);
    const data = courseSchema.safeParse(op.values);
    if (!data.success || !("projectId" in current) || current.projectId !== data.data.projectId) return { ok: false as const, error: "invalid" };
    try {
      await rawPrisma.$transaction(async (tx) => {
        await tx.course.update({ where: { id: op.entityId, updatedAt: new Date(op.baseUpdatedAt) }, data: { code: data.data.code.toUpperCase(), name: data.data.name, description: data.data.description || null, hours: data.data.hours === "" || data.data.hours === undefined ? null : Number(data.data.hours) } });
        await tx.auditLog.create({ data: { userId: access.session.user.id, action: "UPDATE", entityType: "Course", entityId: op.entityId, summary: `Updated course ${data.data.code} · ${data.data.name}` } });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { ok: false as const, error: "unique" };
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return { ok: false as const, error: "staleRecord" };
      throw error;
    }
    refresh(); return { ok: true as const, id: op.entityId };
  }
  // Serializability and FK checks prevent a new linked record racing deletion.
  for (let attempt = 0; ; attempt++) {
    try {
      const result = await rawPrisma.$transaction(async (tx) => {
        let label: string;
        if (op.entity === "beneficiaries") {
          const record = await tx.beneficiary.findUnique({ where: { id: op.entityId }, include: { _count: { select: { attendance: true, participation: true, transfers: true } } } });
          if (!record) return { ok: true as const };
          if (record.updatedAt.toISOString() !== op.baseUpdatedAt) return { ok: false as const, error: "staleRecord" };
          if (Object.values(record._count).some((count) => count > 0)) return { ok: false as const, error: "linkedRecords" };
          label = record.code; await tx.beneficiary.delete({ where: { id: record.id } });
        } else if (op.entity === "projects") {
          const record = await tx.project.findUnique({ where: { id: op.entityId }, include: { _count: { select: { beneficiaries: true, courses: true, activities: true } } } });
          if (!record) return { ok: true as const };
          if (record.updatedAt.toISOString() !== op.baseUpdatedAt) return { ok: false as const, error: "staleRecord" };
          if (Object.values(record._count).some((count) => count > 0)) return { ok: false as const, error: "linkedRecords" };
          label = record.code; await tx.project.delete({ where: { id: record.id } });
        } else {
          const record = await tx.course.findUnique({ where: { id: op.entityId }, include: { _count: { select: { cohorts: true } } } });
          if (!record) return { ok: true as const };
          if (record.updatedAt.toISOString() !== op.baseUpdatedAt) return { ok: false as const, error: "staleRecord" };
          if (record._count.cohorts) return { ok: false as const, error: "linkedRecords" };
          label = record.code; await tx.course.delete({ where: { id: record.id } });
        }
        await tx.auditLog.create({ data: { userId: access.session.user.id, action: "DELETE", entityType: op.entity, entityId: op.entityId, summary: `Permanently deleted ${op.entity} ${label}` } });
        return { ok: true as const };
      }, { isolationLevel: "Serializable" });
      refresh(); return result;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2034" && attempt < 2) continue;
        if (error.code === "P2003") return { ok: false as const, error: "linkedRecords" };
      }
      throw error;
    }
  }
}
