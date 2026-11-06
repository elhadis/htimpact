import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { guard } from "@/lib/guard";
import { getCourse } from "@/lib/queries";
import { Forbidden } from "@/components/forbidden";
import { PageHeader } from "@/components/chrome";
import { CourseForm } from "@/components/learning-forms";
export default async function EditCourse({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params; setRequestLocale(locale);
  const access = await guard("courses", "update"); if (!access.ok) return <Forbidden />;
  const course = await getCourse(id); if (!course) notFound(); const t = await getTranslations();
  return <div><PageHeader title={t("adminRecords.editCourse")} description={course.name} /><CourseForm courseId={course.id} updatedAt={course.updatedAt.toISOString()} projects={[course.project]} defaults={{ projectId: course.projectId, code: course.code, name: course.name, description: course.description ?? "", hours: course.hours ?? "" }} /></div>;
}
