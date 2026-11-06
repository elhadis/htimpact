import { getTranslations, setRequestLocale } from "next-intl/server";
import { guard } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { attendanceStatuses } from "@/lib/validators";
import { PageHeader } from "@/components/chrome";
import { Forbidden } from "@/components/forbidden";
import { Link } from "@/i18n/navigation";
import { formatDateTime } from "@/lib/format";
import type { AttendanceStatus } from "@prisma/client";
export default async function AttendanceRecords({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ status?: string; centerId?: string }> }) {
  const { locale } = await params; setRequestLocale(locale);
  const access = await guard("attendance", "read"); if (!access.ok) return <Forbidden />;
  const t = await getTranslations();
  const filters = await searchParams;
  const status = attendanceStatuses.includes(filters.status as AttendanceStatus) ? filters.status as AttendanceStatus : undefined;
  const rows = await prisma.attendanceRecord.findMany({
    where: { ...(status ? { status } : filters.status === "positive" ? { status: { in: ["PRESENT", "LATE"] } } : {}), ...(filters.centerId ? { session: { cohort: { centerId: filters.centerId } } } : {}) },
    include: { beneficiary: { select: { code: true, firstName: true, lastName: true } }, session: { select: { id: true, title: true, scheduledAt: true } } },
    orderBy: { recordedAt: "desc" },
  });
  return <div><PageHeader title={t("attendance.title")} description={`${rows.length}`} /><div className="overflow-x-auto rounded-xl border bg-card"><table className="w-full min-w-[600px] text-sm"><thead><tr className="border-b"><th className="p-3 text-start">{t("beneficiaries.name")}</th><th className="p-3 text-start">{t("learning.sessionTitle")}</th><th className="p-3 text-start">{t("projects.status")}</th><th className="p-3 text-start">{t("learning.when")}</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-b"><td className="p-3">{row.beneficiary.code} · {row.beneficiary.firstName} {row.beneficiary.lastName}</td><td className="p-3"><Link className="text-teal" href={`/attendance/${row.session.id}`}>{row.session.title}</Link></td><td className="p-3">{t(`enums.${row.status}`)}</td><td className="p-3">{formatDateTime(row.session.scheduledAt.toISOString(), locale)}</td></tr>)}</tbody></table></div></div>;
}
