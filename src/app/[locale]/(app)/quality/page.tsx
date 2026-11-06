import { getTranslations, setRequestLocale } from "next-intl/server";
import { guard } from "@/lib/guard";
import { qualityData } from "@/lib/quality";
import { PageHeader } from "@/components/chrome";
import { Forbidden } from "@/components/forbidden";
import { QualityOverview } from "@/components/quality-overview";

export default async function QualityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; setRequestLocale(locale);
  const access = await guard("quality", "read");
  if (!access.ok) return <Forbidden />;
  const t = await getTranslations();
  const data = await qualityData();
  return <div><PageHeader title={t("quality.title")} description={t("quality.intro")} /><QualityOverview data={data} locale={locale} centerOnly={access.session.user.role !== "ADMIN"} /></div>;
}
