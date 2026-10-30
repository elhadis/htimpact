import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { optionLists } from "@/lib/queries";
import { PageHeader, EmptyState } from "@/components/chrome";
import { Forbidden } from "@/components/forbidden";
import { CourseForm } from "@/components/learning-forms";

export default async function NewCoursePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user || !can(session.user.role, "courses", "create")) return <Forbidden />;
  const t = await getTranslations();
  const options = await optionLists();
  const projects = options.projects.filter((project) => project.type === "EDUCATIONAL");
  return (
    <div>
      <PageHeader title={t("learning.newCourse")} description={t("learning.coursesIntro")} />
      {projects.length === 0 ? <EmptyState title={t("learning.noEducational")} /> : <CourseForm projects={projects} />}
    </div>
  );
}
