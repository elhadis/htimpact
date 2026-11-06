import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { listSessions } from "@/lib/queries";
import { PageHeader, EmptyState } from "@/components/chrome";
import { Forbidden } from "@/components/forbidden";
import { SessionsTable } from "@/components/lists";

export default async function AttendancePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ centerId?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user || !can(session.user.role, "attendance", "read")) return <Forbidden />;
  const t = await getTranslations();
  const rows = await listSessions((await searchParams).centerId);
  return (
    <div>
      <PageHeader title={t("attendance.title")} description={t("attendance.intro")} />
      {rows.length === 0 ? <EmptyState title={t("attendance.empty")} /> : <SessionsTable rows={rows} />}
    </div>
  );
}
