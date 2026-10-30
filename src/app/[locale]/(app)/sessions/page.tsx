import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { listSessions } from "@/lib/queries";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader, EmptyState } from "@/components/chrome";
import { Forbidden } from "@/components/forbidden";
import { SessionsTable } from "@/components/lists";

export default async function SessionsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user || !can(session.user.role, "sessions", "read")) return <Forbidden />;
  const t = await getTranslations();
  const rows = await listSessions();
  return (
    <div>
      <PageHeader
        title={t("learning.sessionsTitle")}
        description={t("learning.sessionsIntro")}
        action={
          can(session.user.role, "sessions", "create") ? (
            <Link className={buttonVariants()} href="/sessions/new">
              {t("learning.newSession")}
            </Link>
          ) : null
        }
      />
      {rows.length === 0 ? <EmptyState title={t("attendance.empty")} /> : <SessionsTable rows={rows} />}
    </div>
  );
}
