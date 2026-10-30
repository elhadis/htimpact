import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { buildReport, optionLists } from "@/lib/queries";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/chrome";
import { Forbidden } from "@/components/forbidden";
import { EnumBadge } from "@/components/enum-badge";

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ projectId?: string }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user || !can(session.user.role, "reports", "read")) return <Forbidden />;
  const t = await getTranslations();
  const [report, options] = await Promise.all([buildReport(query.projectId), optionLists()]);
  const canExport = can(session.user.role, "reports", "export");
  const projectQuery = query.projectId ? `&projectId=${query.projectId}` : "";

  return (
    <div>
      <PageHeader
        title={t("reports.title")}
        description={t("reports.intro")}
        action={
          canExport ? (
            <>
              <a className={buttonVariants({ variant: "teal" })} href={`/api/reports/excel?locale=${locale}${projectQuery}`}>
                {t("reports.excel")}
              </a>
              <a className={buttonVariants({ variant: "outline" })} href={`/api/reports/pdf?locale=${locale}${projectQuery}`}>
                {t("reports.pdf")}
              </a>
            </>
          ) : null
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <a className={buttonVariants({ variant: query.projectId ? "outline" : "default", size: "sm" })} href={`/${locale}/reports`}>
          {t("common.all")}
        </a>
        {options.projects.map((project) => (
          <a
            key={project.id}
            className={buttonVariants({ variant: query.projectId === project.id ? "default" : "outline", size: "sm" })}
            href={`/${locale}/reports?projectId=${project.id}`}
          >
            {project.code}
          </a>
        ))}
      </div>
      <div className="grid gap-3">
        {report.projects.map((project) => (
          <article key={project.id} className="rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-semibold">{project.name}</h2>
                <p className="text-xs text-muted-foreground">{project.code}</p>
              </div>
              <div className="flex items-center gap-2">
                <EnumBadge value={project.type} />
                <span className="font-semibold text-teal tabular-nums">{project.progress}%</span>
              </div>
            </div>
            <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
              {project.metrics.map((metric) => (
                <li key={metric.metricKey}>
                  {metric.label}: {metric.actual}/{metric.target} {metric.unit}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </div>
  );
}
