import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/chrome";
import { Forbidden } from "@/components/forbidden";
import { ProjectForm } from "@/components/project-form";

export default async function NewProjectPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user || !can(session.user.role, "projects", "create")) return <Forbidden />;
  const t = await getTranslations();
  return (
    <div>
      <PageHeader title={t("projects.new")} description={t("projects.intro")} />
      <ProjectForm
        mode="create"
        defaults={{
          code: "",
          name: "",
          description: "",
          type: "EDUCATIONAL",
          status: "DRAFT",
          startDate: new Date().toISOString().slice(0, 10),
          endDate: "",
          location: "",
          donor: "",
          targets: [
            {
              metricKey: "beneficiaries",
              label: t("metrics.beneficiaries"),
              targetValue: 20,
              unit: t("units.people"),
            },
          ],
        }}
      />
    </div>
  );
}
