import { setRequestLocale, getTranslations } from "next-intl/server";
import { guard } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/chrome";
import { Forbidden } from "@/components/forbidden";
import { CenterForm } from "@/components/center-forms";
export default async function NewCenter({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; setRequestLocale(locale);
  const access = await guard("centers", "create"); if (!access.ok) return <Forbidden />;
  const t = await getTranslations();
  const [projects, managers] = await Promise.all([
    prisma.project.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { active: true, centerId: null, role: { key: "CENTER_MANAGER" } }, select: { id: true, name: true } }),
  ]);
  return <div><PageHeader title={t("centers.new")} /><CenterForm projects={projects} managers={managers} /></div>;
}
