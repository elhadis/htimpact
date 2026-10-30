import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { listCohorts } from "@/lib/queries";
import { formatDate } from "@/lib/format";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/chrome";
import { Forbidden } from "@/components/forbidden";

export default async function CohortsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user || !can(session.user.role, "cohorts", "read")) return <Forbidden />;
  const t = await getTranslations();
  const cohorts = await listCohorts();
  return (
    <div>
      <PageHeader
        title={t("learning.cohortsTitle")}
        description={t("learning.cohortsIntro")}
        action={
          can(session.user.role, "cohorts", "create") ? (
            <Link className={buttonVariants()} href="/cohorts/new">
              {t("learning.newCohort")}
            </Link>
          ) : null
        }
      />
      <div className="grid gap-3">
        {cohorts.map((cohort) => (
          <Link key={cohort.id} href={`/cohorts/${cohort.id}`} className="rounded-xl border bg-card p-4">
            <p className="font-medium">{cohort.name}</p>
            <p className="text-sm text-muted-foreground">
              {cohort.course.project.name} · {cohort.course.name} · {formatDate(cohort.startDate, locale)}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
