import { getTranslations, setRequestLocale } from "next-intl/server";
import { guard } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { PageHeader } from "@/components/chrome";
import { Forbidden } from "@/components/forbidden";
export default async function Activities({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; setRequestLocale(locale);
  const access = await guard("activities", "read"); if (!access.ok) return <Forbidden />;
  const t = await getTranslations();
  const rows = await prisma.activity.findMany({ include: { project: { select: { name: true } } }, orderBy: { name: "asc" } });
  return <div><PageHeader title={t("nav.activities")} /><div className="grid gap-3 sm:grid-cols-2">{rows.map((row) => <Link href={`/projects/${row.projectId}`} key={row.id} className="rounded-xl border bg-card p-4"><p className="font-semibold">{row.name}</p><p className="text-sm text-muted-foreground">{row.project.name}</p></Link>)}</div></div>;
}
