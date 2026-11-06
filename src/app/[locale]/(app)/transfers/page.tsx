import { getTranslations, setRequestLocale } from "next-intl/server";
import { guard } from "@/lib/guard";
import { prisma, rawPrisma } from "@/lib/prisma";
import { PageHeader } from "@/components/chrome";
import { Forbidden } from "@/components/forbidden";
import { TransferForm, TransferReview } from "@/components/center-forms";
import { formatDateTime } from "@/lib/format";
export default async function Transfers({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ status?: string }> }) {
  const { locale } = await params; setRequestLocale(locale);
  const access = await guard("transfers", "read"); if (!access.ok) return <Forbidden />;
  const t = await getTranslations();
  const pendingOnly = (await searchParams).status === "PENDING";
  const [people, destinations, transfers] = await Promise.all([
    prisma.beneficiary.findMany({ select: { id: true, firstName: true, lastName: true, code: true, centerId: true }, orderBy: { lastName: "asc" } }),
    // Destination names are the only cross-center information exposed to managers.
    rawPrisma.center.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.centerTransfer.findMany({ where: pendingOnly ? { status: "PENDING" } : undefined, include: { beneficiary: { select: { code: true, firstName: true, lastName: true } }, fromCenter: { select: { name: true } }, toCenter: { select: { name: true } } }, orderBy: { createdAt: "desc" } }),
  ]);
  return <div className="space-y-5"><PageHeader title={t("centers.transfers")} description={t("centers.approvalHelp")} />
    <TransferForm people={people.map((row) => ({ ...row, name: `${row.firstName} ${row.lastName}` }))} destinations={destinations} />
    {transfers.map((row) => <article key={row.id} className="space-y-3 rounded-xl border bg-card p-4"><h2 className="font-semibold">{row.beneficiary.code} · {row.beneficiary.firstName} {row.beneficiary.lastName}</h2><p>{row.fromCenter.name} → {row.toCenter.name}</p><p className="text-sm text-muted-foreground">{row.reason}</p><p className="text-sm">{t(`centers.${row.status}`)} · {formatDateTime(row.createdAt.toISOString(), locale)}</p>{row.status === "PENDING" && access.session.user.role === "ADMIN" && <TransferReview id={row.id} />}</article>)}
  </div>;
}
