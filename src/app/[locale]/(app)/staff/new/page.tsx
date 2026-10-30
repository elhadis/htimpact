import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { optionLists } from "@/lib/queries";
import { PageHeader } from "@/components/chrome";
import { Forbidden } from "@/components/forbidden";
import { StaffForm } from "@/components/staff-form";

export default async function NewStaffPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user || !can(session.user.role, "staff", "create")) return <Forbidden />;
  const t = await getTranslations();
  const options = await optionLists();
  return (
    <div>
      <PageHeader title={t("staff.new")} description={t("staff.intro")} />
      <StaffForm
        mode="create"
        projects={options.projects}
        defaults={{
          name: "",
          email: "",
          password: "",
          role: "FACILITATOR",
          phone: "",
          title: "",
          projectIds: [],
        }}
      />
    </div>
  );
}
