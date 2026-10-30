import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { formatDateTime, fullName } from "@/lib/format";
import { getCohort, optionLists } from "@/lib/queries";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/chrome";
import { Forbidden } from "@/components/forbidden";
import { EnrollForm } from "@/components/learning-forms";

export default async function CohortPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user || !can(session.user.role, "cohorts", "read")) return <Forbidden />;
  const cohort = await getCohort(id);
  if (!cohort) notFound();
  const t = await getTranslations();
  const options = await optionLists();
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={cohort.course.name}
        title={cohort.name}
        description={cohort.course.project.name}
        action={
          can(session.user.role, "sessions", "create") ? (
            <Link className={buttonVariants()} href={`/sessions/new?cohort=${cohort.id}`}>
              {t("learning.newSession")}
            </Link>
          ) : null
        }
      />
      {can(session.user.role, "cohorts", "update") ? (
        <section className="rounded-xl border bg-card p-4">
          <h2 className="font-semibold">{t("learning.enroll")}</h2>
          <p className="mt-1 mb-3 text-sm text-muted-foreground">{t("learning.enrollHelp")}</p>
          <EnrollForm cohortId={cohort.id} people={options.people} />
        </section>
      ) : null}
      <section>
        <h2 className="mb-3 font-semibold">{t("projects.people")}</h2>
        <ul className="space-y-2">
          {cohort.enrollments.map((enrollment) => (
            <li key={enrollment.id} className="rounded-lg border bg-card px-3 py-2">
              <Link href={`/beneficiaries/${enrollment.beneficiary.id}`}>
                {enrollment.beneficiary.code} · {fullName(enrollment.beneficiary)}
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="mb-3 font-semibold">{t("learning.sessionsTitle")}</h2>
        <ul className="space-y-2">
          {cohort.sessions.map((sessionRow) => (
            <li key={sessionRow.id}>
              <Link href={`/attendance/${sessionRow.id}`} className="block rounded-lg border bg-card px-3 py-2">
                <span className="font-medium">{sessionRow.title}</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {formatDateTime(sessionRow.scheduledAt, locale)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
