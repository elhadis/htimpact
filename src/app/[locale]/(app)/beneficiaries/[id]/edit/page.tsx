import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { toDateInput } from "@/lib/format";
import { getBeneficiary, optionLists } from "@/lib/queries";
import { PageHeader } from "@/components/chrome";
import { Forbidden } from "@/components/forbidden";
import { BeneficiaryForm } from "@/components/beneficiary-form";

export default async function EditBeneficiaryPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user || !can(session.user.role, "beneficiaries", "update")) return <Forbidden />;
  const person = await getBeneficiary(id);
  if (!person) notFound();
  const options = await optionLists();
  const t = await getTranslations();
  return (
    <div>
      <PageHeader title={t("beneficiaries.edit")} description={`${person.firstName} ${person.lastName}`} />
      <BeneficiaryForm
        mode="edit"
        updatedAt={person.updatedAt.toISOString()}
        beneficiaryId={person.id}
        projects={options.projects}
        centers={options.centers}
        defaults={{
          centerId: person.centerId ?? "",
          firstName: person.firstName,
          lastName: person.lastName,
          gender: person.gender,
          dateOfBirth: toDateInput(person.dateOfBirth),
          phone: person.phone ?? "",
          nationalId: person.nationalId ?? "",
          community: person.community ?? "",
          notes: person.notes ?? "",
          projectIds: person.projects.filter((link) => link.status !== "withdrawn").map((link) => link.projectId),
        }}
      />
    </div>
  );
}
