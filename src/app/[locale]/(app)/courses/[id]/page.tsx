import { AdminRecordActions } from "@/components/admin-record-actions";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { formatDate } from "@/lib/format";
import { getCourse } from "@/lib/queries";
import { Link } from "@/i18n/navigation";
import { PageHeader } from "@/components/chrome";
import { Forbidden } from "@/components/forbidden";

export default async function CoursePage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user || !can(session.user.role, "courses", "read")) return <Forbidden />;
  const course = await getCourse(id);
  if (!course) notFound();
  const t = await getTranslations();
  return (
    <div>
      <PageHeader eyebrow={course.code} title={course.name} description={course.project.name} action={session.user.role === "ADMIN" ? <AdminRecordActions entity="courses" id={course.id} label={course.name} updatedAt={course.updatedAt.toISOString()} detail /> : null} />
      <div className="grid gap-3">
        {course.cohorts.map((cohort) => (
          <Link key={cohort.id} href={`/cohorts/${cohort.id}`} className="rounded-xl border bg-card p-4">
            <p className="font-medium">{cohort.name}</p>
            <p className="text-sm text-muted-foreground">
              {formatDate(cohort.startDate, locale)} · {cohort._count.enrollments} · {cohort._count.sessions}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
