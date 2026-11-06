import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { can, isAppRole } from "@/lib/rbac";
import { getStaff, optionLists } from "@/lib/queries";
import { PageHeader } from "@/components/chrome";
import { Forbidden } from "@/components/forbidden";
import { StaffForm } from "@/components/staff-form";

export default async function EditStaffPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user || !can(session.user.role, "staff", "update")) return <Forbidden />;
  const user = await getStaff(id);
  if (!user || !isAppRole(user.role.key)) notFound();
  const t = await getTranslations();
  const options = await optionLists();
  return (
    <div>
      <PageHeader title={t("staff.edit")} description={user.email} />
      <StaffForm
        mode="edit"
        userId={user.id}
        projects={options.projects}
        centers={options.centers}
        defaults={{
          centerId: user.centerId ?? "",
          name: user.name,
          email: user.email,
          role: user.role.key,
          phone: user.phone ?? "",
          title: user.title ?? "",
          active: user.active,
          projectIds: user.projectAssignments.map((link) => link.projectId),
        }}
      />
    </div>
  );
}
