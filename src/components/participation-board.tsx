"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { saveParticipation } from "@/server/mutations";
import { offlineDb, queueModeEnabled } from "@/lib/offline/db";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export function ParticipationBoard({
  activityId,
  rows,
  canEdit,
}: {
  activityId: string;
  canEdit: boolean;
  rows: { beneficiaryId: string; name: string; participated: boolean }[];
}) {
  const t = useTranslations();
  const [marks, setMarks] = useState(rows);
  const [saving, setSaving] = useState(false);

  async function onSave() {
    const payload = {
      clientMutationId: crypto.randomUUID(),
      activityId,
      rows: marks.map((row) => ({ beneficiaryId: row.beneficiaryId, participated: row.participated })),
    };
    if (queueModeEnabled()) {
      await offlineDb.participationQueue.put(payload);
      toast.success(t("common.saved"));
      return;
    }
    setSaving(true);
    try {
      const result = await saveParticipation({ activityId, rows: payload.rows });
      if (!result.ok) {
        toast.error(t(`errors.${result.error}`));
        return;
      }
      toast.success(t("common.saved"));
    } catch {
      await offlineDb.participationQueue.put(payload);
      toast.success(t("common.saved"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      {marks.map((row) => (
        <label key={row.beneficiaryId} className="flex items-center gap-3 rounded-lg border bg-card px-3 py-3">
          <Checkbox
            checked={row.participated}
            disabled={!canEdit}
            onCheckedChange={(value) =>
              setMarks((current) =>
                current.map((item) =>
                  item.beneficiaryId === row.beneficiaryId ? { ...item, participated: value === true } : item,
                ),
              )
            }
          />
          <span className="text-sm">{row.name}</span>
        </label>
      ))}
      {canEdit ? (
        <Button type="button" className="mt-3" onClick={() => void onSave()} disabled={saving}>
          {t("learning.saveParticipation")}
        </Button>
      ) : null}
    </div>
  );
}
