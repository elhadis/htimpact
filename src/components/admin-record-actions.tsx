"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Link, useRouter } from "@/i18n/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { offlineDb, queueModeEnabled } from "@/lib/offline/db";
import { invalidateDeletedRecord } from "@/lib/offline/admin-records";
import { applyAdminOperation } from "@/server/admin-records";
export function AdminRecordActions({ entity, id, label, updatedAt, detail = false }: { entity: "beneficiaries" | "projects" | "courses"; id: string; label: string; updatedAt: string; detail?: boolean }) {
  const t = useTranslations(); const router = useRouter(); const [busy, setBusy] = useState(false);
  async function remove() {
    if (!window.confirm(t("adminRecords.confirmDelete", { name: label }))) return;
    setBusy(true);
    const pending = { clientMutationId: crypto.randomUUID(), kind: "delete" as const, entity, entityId: id, label, baseUpdatedAt: updatedAt };
    const queue = async () => { await offlineDb.adminQueue.put(pending); toast.success(t("adminRecords.deleteQueued")); };
    try {
      if (queueModeEnabled()) { await queue(); return; }
      const result = await applyAdminOperation(pending);
      if (!result.ok) { toast.error(t(`errors.${result.error}`)); return; }
      await invalidateDeletedRecord(entity, id);
      toast.success(t("adminRecords.deleted"));
      if (detail) router.push(`/${entity}`);
      router.refresh(); window.dispatchEvent(new Event("ht-data-synced"));
    } catch { try { await queue(); } catch { toast.error(t("errors.syncFailed")); } }
    finally { setBusy(false); }
  }
  return <div className="flex flex-wrap gap-2"><Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`/${entity}/${id}/edit`}>{t("common.edit")}</Link><Button variant="destructive" size="sm" disabled={busy} onClick={() => void remove()}>{t("adminRecords.delete")}</Button></div>;
}
