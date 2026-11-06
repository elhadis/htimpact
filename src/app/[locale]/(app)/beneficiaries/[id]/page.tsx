import { AdminRecordActions } from "@/components/admin-record-actions";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { formatDate, fullName } from "@/lib/format";
import { getBeneficiary } from "@/lib/queries";
import { Link } from "@/i18n/navigation";
import { PageHeader } from "@/components/chrome";
import { Forbidden } from "@/components/forbidden";
import { EnumBadge } from "@/components/enum-badge";

export default async function BeneficiaryPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user || !can(session.user.role, "beneficiaries", "read")) return <Forbidden />;
  const person = await getBeneficiary(id);
  if (!person) notFound();
  const t = await getTranslations();
  return (
    <div>
      <PageHeader
        eyebrow={person.code}
        title={fullName(person)}
        description={person.community || person.notes || t("beneficiaries.intro")}
        action={
          can(session.user.role, "beneficiaries", "update") ? (
            <AdminRecordActions entity="beneficiaries" id={person.id} label={fullName(person)} updatedAt={person.updatedAt.toISOString()} detail />
          ) : null
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">{t("beneficiaries.projects")}</h2>
          <ul className="mt-3 space-y-2">
            {person.projects.map((link) => (
              <li key={link.id} className="flex items-center justify-between gap-3 rounded-lg bg-background px-3 py-2">
                <Link href={`/projects/${link.project.id}`} className="font-medium">
                  {link.project.name}
                </Link>
                <EnumBadge value={link.status} />
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">{t("learning.cohortsTitle")}</h2>
          <ul className="mt-3 space-y-2">
            {person.enrollments.map((enrollment) => (
              <li key={enrollment.id} className="rounded-lg bg-background px-3 py-2">
                <Link href={`/cohorts/${enrollment.cohort.id}`} className="font-medium">
                  {enrollment.cohort.name}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {enrollment.cohort.course.name} · {enrollment.cohort.course.project.name}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <section className="mt-4 rounded-xl border bg-card p-5 text-sm text-muted-foreground">
        <p>
          {t("beneficiaries.gender")}: {t(`enums.${person.gender}`)}
        </p>
        <p>
          {t("beneficiaries.birthDate")}: {formatDate(person.dateOfBirth, locale)}
        </p>
        <p>
          {t("beneficiaries.nationalId")}: {person.nationalId || "—"}
        </p>
        <p>
          {t("beneficiaries.phone")}: {person.phone || "—"}
        </p>
      </section>
    </div>
  );
}
