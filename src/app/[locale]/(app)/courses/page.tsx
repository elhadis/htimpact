import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { listCourses } from "@/lib/queries";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/chrome";
import { Forbidden } from "@/components/forbidden";

export default async function CoursesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user || !can(session.user.role, "courses", "read")) return <Forbidden />;
  const t = await getTranslations();
  const courses = await listCourses();
  return (
    <div>
      <PageHeader
        title={t("learning.coursesTitle")}
        description={t("learning.coursesIntro")}
        action={
          can(session.user.role, "courses", "create") ? (
            <Link className={buttonVariants()} href="/courses/new">
              {t("learning.newCourse")}
            </Link>
          ) : null
        }
      />
      <div className="grid gap-3">
        {courses.map((course) => (
          <Link key={course.id} href={`/courses/${course.id}`} className="rounded-xl border bg-card p-4">
            <p className="font-medium">{course.name}</p>
            <p className="text-sm text-muted-foreground">
              {course.code} · {course.project.name} · {course.cohorts.length}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
