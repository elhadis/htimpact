import { setRequestLocale, getTranslations } from "next-intl/server";
import { guard } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { PageHeader } from "@/components/chrome";
import { Forbidden } from "@/components/forbidden";
import { buttonVariants } from "@/components/ui/button";

export default async function CentersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; setRequestLocale(locale);
  const access = await guard("centers", "read"); if (!access.ok) return <Forbidden />;
  const t = await getTranslations();
  const centers = await prisma.center.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { beneficiaries: true, projects: true } }, staff: { where: { active: true, role: { key: "CENTER_MANAGER" } }, select: { name: true } } } });
  return <div><PageHeader title={t("centers.title")} description={t("centers.intro")} action={access.session.user.role === "ADMIN" ? <Link href="/centers/new" className={buttonVariants()}>{t("centers.new")}</Link> : null} />
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{centers.map((center) => <Link key={center.id} href={`/centers/${center.id}`} className="space-y-3 rounded-2xl border bg-card p-5 shadow-sm transition hover:bg-secondary/40">
      <p className="text-xs text-muted-foreground">{center.code} · {center.active ? t("staff.active") : t("centers.inactive")}</p><h2 className="font-semibold">{center.name}</h2>
      <p className="text-sm text-muted-foreground">{center.location}</p><p>{center._count.beneficiaries} {t("nav.beneficiaries")} · {center._count.projects} {t("nav.projects")}</p>
      <p className="text-sm">{center.staff.map((row) => row.name).join(", ")}</p>
    </Link>)}</div>
    {!centers.length && <p className="rounded-xl border p-5 text-muted-foreground">{t("centers.empty")}</p>}
  </div>;
}
