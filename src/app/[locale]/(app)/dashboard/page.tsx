import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { dashboardData } from "@/lib/queries";
import { formatDateTime, percentLabel } from "@/lib/format";
import { PageHeader, StatCard } from "@/components/chrome";
import { Progress } from "@/components/ui/progress";
import { EnumBadge } from "@/components/enum-badge";

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const data = await dashboardData();

  return (
    <div>
      <PageHeader eyebrow={t("common.company")} title={t("dashboard.title")} description={t("dashboard.intro")} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("dashboard.projects")} value={String(data.activeProjects)} />
        <StatCard label={t("dashboard.beneficiaries")} value={String(data.beneficiaryCount)} />
        <StatCard label={t("dashboard.attendance")} value={percentLabel(data.attendanceRate)} />
        <StatCard label={t("dashboard.conflicts")} value={String(data.conflictCount)} />
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        {[
          { href: "/projects", label: locale === "ar" ? "المشاريع" : "Projects" },
          { href: "/beneficiaries", label: locale === "ar" ? "المستفيدون" : "Beneficiaries" },
          { href: "/courses", label: locale === "ar" ? "الدورات" : "Courses" },
          { href: "/attendance", label: locale === "ar" ? "الحضور" : "Attendance" },
        ].map((action) => (
          <Link key={action.href} href={action.href} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90">
            {action.label}
          </Link>
        ))}
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <section className="space-y-3 rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="font-semibold text-primary">{t("dashboard.progress")}</h2>
          {data.projects.length === 0 && (
            <p className="rounded-xl bg-secondary p-5 text-sm text-muted-foreground">{locale === "ar" ? "لا توجد مشاريع نشطة حالياً" : "No active projects yet"}</p>
          )}
          {data.projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`} className="block rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{project.name}</p>
                  <p className="text-xs text-muted-foreground">{project.code}</p>
                </div>
                <div className="flex items-center gap-2">
                  <EnumBadge value={project.type} />
                  <span className="text-sm font-semibold tabular-nums text-teal">{project.progress.overall}%</span>
                </div>
              </div>
              <Progress className="mt-3" value={project.progress.overall} />
            </Link>
          ))}
        </section>
        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="font-semibold text-primary">{t("dashboard.recent")}</h2>
          {data.audits.length === 0 && <p className="mt-3 text-sm text-muted-foreground">{locale === "ar" ? "لا توجد أنشطة حديثة" : "No recent activity"}</p>}
          <ul className="mt-3 space-y-3">
            {data.audits.map((entry) => (
              <li key={entry.id} className="rounded-xl border bg-card p-3">
                <p className="text-sm">{entry.summary}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {entry.actor} · {formatDateTime(entry.createdAt, locale)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
