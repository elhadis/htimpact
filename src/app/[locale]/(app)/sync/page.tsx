import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { formatDateTime } from "@/lib/format";
import { listConflicts } from "@/lib/queries";
import { PageHeader } from "@/components/chrome";
import { Forbidden } from "@/components/forbidden";
import { EnumBadge } from "@/components/enum-badge";
import { ConflictActions } from "@/components/conflict-actions";

export default async function SyncPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user || !can(session.user.role, "sync", "read")) return <Forbidden />;
  const t = await getTranslations();
  const conflicts = await listConflicts();
  const pending = conflicts.filter((row) => row.status === "pending");
  const history = conflicts.filter((row) => row.status !== "pending");
  const canResolve = can(session.user.role, "sync", "update");

  return (
    <div className="space-y-8">
      <PageHeader title={t("sync.title")} description={t("sync.intro")} />
      <section className="rounded-xl border bg-card p-5">
        <h2 className="font-semibold">{t("sync.rulesTitle")}</h2>
        <ol className="mt-3 list-decimal space-y-2 ps-5 text-sm leading-6 text-muted-foreground">
          <li>{t("sync.rule1")}</li>
          <li>{t("sync.rule2")}</li>
          <li>{t("sync.rule3")}</li>
          <li>{t("sync.rule4")}</li>
          <li>{t("sync.rule5")}</li>
          <li>{t("sync.rule6")}</li>
        </ol>
      </section>
      <section className="space-y-3">
        <h2 className="font-semibold">{t("sync.pending")}</h2>
        {pending.length === 0 ? <p className="text-sm text-muted-foreground">{t("common.empty")}</p> : null}
        {pending.map((conflict) => (
          <article key={conflict.id} className="rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <EnumBadge value={conflict.status} />
              <span className="text-xs text-muted-foreground">{conflict.rule}</span>
            </div>
            <p className="mt-2 text-sm">{conflict.message}</p>
            <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(conflict.createdAt, locale)}</p>
            {canResolve ? (
              <div className="mt-3">
                <ConflictActions id={conflict.id} />
              </div>
            ) : null}
          </article>
        ))}
      </section>
      <section className="space-y-3">
        <h2 className="font-semibold">{t("sync.history")}</h2>
        {history.map((conflict) => (
          <article key={conflict.id} className="rounded-xl border bg-card p-4">
            <EnumBadge value={conflict.status} />
            <p className="mt-2 text-sm">{conflict.message}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
