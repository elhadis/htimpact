import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { listBeneficiaries } from "@/lib/queries";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/chrome";
import { Forbidden } from "@/components/forbidden";
import { BeneficiariesTable } from "@/components/lists";

export default async function BeneficiariesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user || !can(session.user.role, "beneficiaries", "read")) return <Forbidden />;
  const t = await getTranslations();
  const rows = await listBeneficiaries();
  return (
    <div>
      <PageHeader
        title={t("beneficiaries.title")}
        description={t("beneficiaries.intro")}
        action={
          can(session.user.role, "beneficiaries", "create") ? (
            <Link className={buttonVariants()} href="/beneficiaries/new">
              {t("beneficiaries.new")}
            </Link>
          ) : null
        }
      />
      <BeneficiariesTable rows={rows} />
    </div>
  );
}
