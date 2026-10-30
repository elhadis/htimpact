import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { optionLists } from "@/lib/queries";
import { PageHeader } from "@/components/chrome";
import { Forbidden } from "@/components/forbidden";
import { BeneficiaryForm } from "@/components/beneficiary-form";

export default async function NewBeneficiaryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user || !can(session.user.role, "beneficiaries", "create")) return <Forbidden />;
  const t = await getTranslations();
  const options = await optionLists();
  return (
    <div>
      <PageHeader title={t("beneficiaries.new")} description={t("beneficiaries.projectsHelp")} />
      <BeneficiaryForm
        mode="create"
        projects={options.projects}
        defaults={{
          firstName: "",
          lastName: "",
          gender: "UNSPECIFIED",
          dateOfBirth: "",
          phone: "",
          nationalId: "",
          community: "",
          notes: "",
          projectIds: [],
        }}
      />
    </div>
  );
}
