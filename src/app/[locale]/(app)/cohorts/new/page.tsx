import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { optionLists } from "@/lib/queries";
import { PageHeader } from "@/components/chrome";
import { Forbidden } from "@/components/forbidden";
import { CohortForm } from "@/components/learning-forms";

export default async function NewCohortPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user || !can(session.user.role, "cohorts", "create")) return <Forbidden />;
  const t = await getTranslations();
  const options = await optionLists();
  return (
    <div>
      <PageHeader title={t("learning.newCohort")} description={t("learning.cohortsIntro")} />
      <CohortForm centers={options.centers} courses={options.courses} />
    </div>
  );
}
