import { Prisma, PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const rawPrisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = rawPrisma;

type Args = Record<string, unknown>;
const models = new Map(Prisma.dmmf.datamodel.models.map((model) => [model.name, model]));

// Prisma does not apply query extensions to nested includes. Scope relation lists
// and relation counts explicitly as well as the top-level query.
function scopeRelations(model: string, args: Args, scope: { centerId: string; userId: string }, filter: (model: string, scope: { centerId: string; userId: string }) => Args | null) {
  for (const key of ["include", "select"]) {
    const selection = args[key] as Args | undefined;
    if (!selection) continue;
    for (const field of models.get(model)?.fields ?? []) {
      if (field.kind !== "object" || !selection[field.name]) continue;
      const nested: Args = selection[field.name] === true ? {} : { ...selection[field.name] as Args };
      const where = filter(field.type, scope);
      if (field.isList && where) nested.where = { AND: [nested.where ?? {}, where] };
      scopeRelations(field.type, nested, scope, filter);
      // to-one `true` must remain true unless nested selection was specified.
      selection[field.name] = field.isList || selection[field.name] !== true ? nested : true;
    }
    const count = selection._count;
    if (count) {
      const counts: Args = count === true ? { select: Object.fromEntries((models.get(model)?.fields ?? []).filter((f) => f.kind === "object" && f.isList).map((f) => [f.name, true])) } : { ...count as Args };
      const selected = counts.select as Args | undefined;
      if (selected) for (const field of models.get(model)?.fields ?? []) {
        if (!field.isList || !selected[field.name]) continue;
        const where = filter(field.type, scope);
        if (where) selected[field.name] = { where: { AND: [(selected[field.name] as Args)?.where ?? {}, where] } };
      }
      selection._count = counts;
    }
  }
}

export const prisma = rawPrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        args = structuredClone(args);
        const { centerScope, scopeFilter } = await import("@/lib/center-scope");
        const scope = await centerScope();
        if (scope) {
          const scoped = args as Args;
          const where = scopeFilter(model, scope);
          if (where && !["create", "createMany", "createManyAndReturn"].includes(operation)) {
            // Keep unique selectors at top level, as required by findUnique/upsert.
            scoped.where = { ...scoped.where as Args, AND: [(scoped.where as Args)?.AND ?? {}, where] };
          }
          scopeRelations(model, scoped, scope, scopeFilter);
        }
        return query(args);
      },
    },
  },
}) as unknown as PrismaClient;
