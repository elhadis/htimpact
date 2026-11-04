"use client";

import { useEffect, useState } from "react";
import { offlineDb } from "@/lib/offline/db";

type PendingItem = { id: string; type: string; detail: string };

export function PendingOfflineChanges({ locale }: { locale: string }) {
  const [items, setItems] = useState<PendingItem[]>([]);

  useEffect(() => {
    let active = true;
    async function load() {
      const [attendance, assignments, participation, enrollments] = await Promise.all([
        offlineDb.attendanceQueue.toArray(),
        offlineDb.assignmentQueue.toArray(),
        offlineDb.participationQueue.toArray(),
        offlineDb.enrollmentQueue.toArray(),
      ]);
      if (!active) return;
      setItems([
        ...attendance.map((row) => ({
          id: row.clientMutationId,
          type: locale === "ar" ? "حضور" : "Attendance",
          detail: row.beneficiaryName,
        })),
        ...participation.map((row) => ({
          id: row.clientMutationId,
          type: locale === "ar" ? "مشاركة نشاط" : "Activity participation",
          detail: row.activityId + " (" + row.rows.length + ")",
        })),
        ...enrollments.map((row) => ({
          id: row.clientMutationId,
          type: locale === "ar" ? "تسجيل في مجموعة تدريبية" : "Cohort enrollment",
          detail: row.cohortId + " — " + row.beneficiaryId,
        })),
        ...assignments.map((row) => ({
          id: row.clientMutationId,
          type: locale === "ar" ? "إسناد مشروع" : "Project assignment",
          detail: row.beneficiaryName + " — " + row.projectName,
        })),
      ]);
    }
    void load();
    const timer = window.setInterval(() => void load(), 4000);
    return () => { active = false; window.clearInterval(timer); };
  }, [locale]);

  return (
    <section className="space-y-3">
      <h2 className="font-semibold">
        {locale === "ar" ? "التغييرات المحلية بانتظار المزامنة" : "Local changes awaiting sync"} ({items.length})
      </h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {locale === "ar" ? "لا توجد تغييرات محلية معلقة." : "No local changes are pending."}
        </p>
      ) : items.map((item) => (
        <article key={item.id} className="rounded-xl border bg-card p-4">
          <p className="text-sm font-medium">{item.type}</p>
          <p className="text-sm text-muted-foreground">{item.detail}</p>
        </article>
      ))}
      <p className="text-xs text-muted-foreground">
        {locale === "ar"
          ? "اضغط زر المزامنة الموجود في شريط التطبيق بعد الاتصال بالإنترنت."
          : "Use the existing Sync Now button in the app header when online."}
      </p>
    </section>
  );
}
