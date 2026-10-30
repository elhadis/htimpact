import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { optionLists } from "@/lib/queries";
import { PageHeader } from "@/components/chrome";
import { Forbidden } from "@/components/forbidden";
import { SessionForm } from "@/components/learning-forms";

export default async function NewSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ cohort?: string }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user || !can(session.user.role, "sessions", "create")) return <Forbidden />;
  const t = await getTranslations();
  const options = await optionLists();
  const cohorts = query.cohort ? [...options.cohorts].sort((a, b) => (a.id === query.cohort ? -1 : b.id === query.cohort ? 1 : 0)) : options.cohorts;
  return (
    <div>
      <PageHeader title={t("learning.newSession")} description={t("learning.sessionsIntro")} />
      <SessionForm cohorts={cohorts} staff={options.staff} />
    </div>
  );
}
