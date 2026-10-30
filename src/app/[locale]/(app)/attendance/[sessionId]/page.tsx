import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { facilitatorAssigned } from "@/lib/guard";
import { formatDateTime } from "@/lib/format";
import { getAttendanceSheet } from "@/lib/queries";
import { PageHeader, EmptyState } from "@/components/chrome";
import { Forbidden } from "@/components/forbidden";
import { AttendanceBoard } from "@/components/attendance-board";

export default async function AttendanceSheetPage({
  params,
}: {
  params: Promise<{ locale: string; sessionId: string }>;
}) {
  const { locale, sessionId } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user || !can(session.user.role, "attendance", "read")) return <Forbidden />;
  const sheet = await getAttendanceSheet(sessionId);
  if (!sheet) notFound();
  const t = await getTranslations();
  const assigned = await facilitatorAssigned(session.user.id, session.user.role, sheet.projectId);
  const canEdit = can(session.user.role, "attendance", "update") && assigned;
  return (
    <div>
      <PageHeader
        eyebrow={`${sheet.projectName} · ${sheet.cohortName}`}
        title={sheet.title}
        description={`${formatDateTime(sheet.scheduledAt, locale)} · ${sheet.durationMin} · ${sheet.location ?? ""}`}
      />
      {sheet.rows.length === 0 ? (
        <EmptyState title={t("attendance.empty")} />
      ) : (
        <AttendanceBoard sessionId={sheet.id} rows={sheet.rows} canEdit={canEdit} />
      )}
    </div>
  );
}
