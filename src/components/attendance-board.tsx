"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { attendanceStatuses } from "@/lib/validators";
import { offlineDb, queueModeEnabled } from "@/lib/offline/db";
import { saveAttendance } from "@/server/mutations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Row = {
  beneficiaryId: string;
  name: string;
  code: string;
  status: string;
  note: string;
  updatedAt: string | null;
};

const tone: Record<string, string> = {
  PRESENT: "border-teal bg-teal text-white",
  ABSENT: "border-red-700 bg-red-700 text-white",
  LATE: "border-amber-600 bg-amber-600 text-white",
  EXCUSED: "border-primary bg-primary text-white",
};

export function AttendanceBoard({
  sessionId,
  rows,
  canEdit,
}: {
  sessionId: string;
  rows: Row[];
  canEdit: boolean;
}) {
  const t = useTranslations();
  const [marks, setMarks] = useState(rows);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void offlineDb.rosters.put({
      sessionId,
      updatedAt: new Date().toISOString(),
      payload: JSON.stringify(rows),
    });
  }, [rows, sessionId]);

  function update(beneficiaryId: string, patch: Partial<Row>) {
    setMarks((current) => current.map((row) => (row.beneficiaryId === beneficiaryId ? { ...row, ...patch } : row)));
  }

  async function onSave() {
    const changed = marks.filter((row) => row.status);
    if (changed.length === 0) {
      toast.error(t("attendance.pickStatus"));
      return;
    }
    const payload = changed.map((row) => ({
      beneficiaryId: row.beneficiaryId,
      beneficiaryName: row.name,
      status: row.status as "PRESENT" | "ABSENT" | "LATE" | "EXCUSED",
      note: row.note || null,
      recordedAt: new Date().toISOString(),
      baseUpdatedAt: row.updatedAt,
      clientMutationId: crypto.randomUUID(),
      sessionId,
    }));
    if (queueModeEnabled()) {
      await offlineDb.attendanceQueue.bulkPut(payload);
      toast.success(t("attendance.queued"));
      return;
    }
    setSaving(true);
    try {
      const result = await saveAttendance({
        sessionId,
        rows: payload.map(({ beneficiaryName: _name, sessionId: _session, ...row }) => row),
      });
      if (!result.ok) {
        toast.error(t(`errors.${result.error}`));
        return;
      }
      const conflicts = result.results.filter((item) => item.result === "conflict").length;
      const rejected = result.results.filter((item) => item.result === "rejected").length;
      if (conflicts || rejected) toast.message(t("attendance.review"));
      else toast.success(t("common.saved"));
    } catch {
      await offlineDb.attendanceQueue.bulkPut(payload);
      toast.success(t("attendance.queued"));
    } finally {
      setSaving(false);
    }
  }

  async function downloadOffline() {
    await offlineDb.rosters.put({
      sessionId,
      updatedAt: new Date().toISOString(),
      payload: JSON.stringify(marks),
    });
    if ("caches" in window) {
      const cache = await caches.open("ht-impact-v1");
      await cache.add(window.location.href).catch(() => undefined);
    }
    toast.success(t("attendance.savedOffline"));
  }

  return (
    <div className="space-y-3">
      {marks.map((row) => (
        <article key={row.beneficiaryId} className="rounded-xl border bg-card p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-medium">{row.name}</h2>
              <p className="text-xs text-muted-foreground">{row.code}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {attendanceStatuses.map((status) => (
                <button
                  key={status}
                  type="button"
                  disabled={!canEdit}
                  aria-pressed={row.status === status}
                  onClick={() => update(row.beneficiaryId, { status })}
                  className={cn(
                    "h-11 rounded-lg border px-2 text-sm font-medium",
                    row.status === status ? tone[status] : "bg-background",
                  )}
                >
                  {t(`enums.${status}`)}
                </button>
              ))}
            </div>
          </div>
          <Input
            className="mt-3"
            value={row.note}
            disabled={!canEdit}
            placeholder={t("attendance.note")}
            onChange={(event) => update(row.beneficiaryId, { note: event.target.value })}
          />
        </article>
      ))}
      {canEdit ? (
        <div className="sticky bottom-3 flex flex-col gap-2 rounded-xl border bg-card/95 p-3 shadow-lg backdrop-blur sm:flex-row">
          <Button type="button" onClick={() => void onSave()} disabled={saving}>
            {saving ? t("common.saving") : t("attendance.save")}
          </Button>
          <Button type="button" variant="outline" onClick={() => void downloadOffline()}>
            {t("attendance.download")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
