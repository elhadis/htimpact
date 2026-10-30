import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { listAudit } from "@/lib/queries";
import { PageHeader } from "@/components/chrome";
import { Forbidden } from "@/components/forbidden";
import { AuditTable } from "@/components/lists";

export default async function AuditPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user || !can(session.user.role, "audit", "read")) return <Forbidden />;
  const t = await getTranslations();
  const rows = await listAudit();
  return (
    <div>
      <PageHeader title={t("audit.title")} description={t("audit.intro")} />
      <AuditTable rows={rows} />
    </div>
  );
}
