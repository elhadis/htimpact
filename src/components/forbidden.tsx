import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/chrome";

export async function Forbidden() {
  const t = await getTranslations("common");
  return <EmptyState title={t("forbidden")} />;
}
