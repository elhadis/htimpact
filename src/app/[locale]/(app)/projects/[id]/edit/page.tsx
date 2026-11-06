import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { toDateInput } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/chrome";
import { Forbidden } from "@/components/forbidden";
import { ProjectForm } from "@/components/project-form";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user || !can(session.user.role, "projects", "update")) return <Forbidden />;
  const project = await prisma.project.findUnique({ where: { id }, include: { targets: true } });
  if (!project) notFound();
  const t = await getTranslations();
  return (
    <div>
      <PageHeader title={t("projects.edit")} description={project.name} />
      <ProjectForm
        mode="edit"
        updatedAt={project.updatedAt.toISOString()}
        projectId={project.id}
        defaults={{
          code: project.code,
          name: project.name,
          description: project.description ?? "",
          type: project.type,
          status: project.status,
          startDate: toDateInput(project.startDate),
          endDate: toDateInput(project.endDate),
          location: project.location ?? "",
          donor: project.donor ?? "",
          targets: project.targets.map((target) => ({
            metricKey: target.metricKey as "beneficiaries",
            label: target.label,
            targetValue: target.targetValue,
            unit: target.unit,
          })),
        }}
      />
    </div>
  );
}
