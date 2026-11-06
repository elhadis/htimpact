import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { ROLES, can } from "@/lib/rbac";
import { listStaff } from "@/lib/queries";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/chrome";
import { Forbidden } from "@/components/forbidden";
import { StaffTable } from "@/components/lists";

export default async function StaffPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ status?: string; active?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user || !can(session.user.role, "staff", "read")) return <Forbidden />;
  const t = await getTranslations();
  const rows = await listStaff((await searchParams).active === "1");
  return (
    <div className="space-y-8">
      <PageHeader
        title={t("staff.title")}
        description={t("staff.intro")}
        action={
          can(session.user.role, "staff", "create") ? (
            <Link className={buttonVariants()} href="/staff/new">
              {t("staff.new")}
            </Link>
          ) : null
        }
      />
      <StaffTable rows={rows} />
      <section>
        <h2 className="font-semibold text-primary">{t("staff.matrix")}</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {ROLES.map((role) => (
            <article key={role} className="rounded-xl border bg-card p-4">
              <h3 className="font-medium">{t(`roles.${role}`)}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t(`roleHelp.${role}`)}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
