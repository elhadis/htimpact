import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { listProjects } from "@/lib/queries";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/chrome";
import { Forbidden } from "@/components/forbidden";
import { ProjectsTable } from "@/components/lists";

export default async function ProjectsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ status?: string; active?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user || !can(session.user.role, "projects", "read")) return <Forbidden />;
  const t = await getTranslations();
  const rows = await listProjects((await searchParams).status === "active");
  return (
    <div>
      <PageHeader
        title={t("projects.title")}
        description={t("projects.intro")}
        action={
          can(session.user.role, "projects", "create") ? (
            <Link className={buttonVariants()} href="/projects/new">
              {t("projects.new")}
            </Link>
          ) : null
        }
      />
      <ProjectsTable rows={rows} />
    </div>
  );
}
