"use client";

import { useEffect, useState } from "react";
import { offlineDb } from "@/lib/offline/db";

type PendingItem = { id: string; type: string; detail: string };

export function PendingOfflineChanges({ locale }: { locale: string }) {
  const [items, setItems] = useState<PendingItem[]>([]);

  useEffect(() => {
    let active = true;
    async function load() {
      const [attendance, assignments, participation, enrollments, courses, projects, beneficiaries, cohorts, sessions, activities, centers, transfers, admin] = await Promise.all([
        offlineDb.attendanceQueue.toArray(),
        offlineDb.assignmentQueue.toArray(),
        offlineDb.participationQueue.toArray(),
        offlineDb.enrollmentQueue.toArray(),
        offlineDb.courseQueue.toArray(),
        offlineDb.projectQueue.toArray(),
        offlineDb.beneficiaryQueue.toArray(),
        offlineDb.cohortQueue.toArray(),
        offlineDb.sessionQueue.toArray(),
        offlineDb.activityQueue.toArray(),
        offlineDb.centerQueue.toArray(),
        offlineDb.transferQueue.toArray(),
        offlineDb.adminQueue.toArray(),
      ]);
      if (!active) return;
      setItems([
        ...admin.map((row) => ({ id: row.clientMutationId, type: row.kind === "delete" ? locale === "ar" ? "طلب حذف نهائي" : "Permanent deletion request" : locale === "ar" ? "تعديل سجل" : "Record update", detail: row.label })),
        ...centers.map((row) => ({ id: row.clientMutationId, type: locale === "ar" ? "مركز" : "Center", detail: row.values.name })),
        ...transfers.map((row) => ({ id: row.clientMutationId, type: locale === "ar" ? "طلب نقل" : "Transfer request", detail: row.values.beneficiaryId })),
        ...cohorts.map((row) => ({ id: row.clientMutationId, type: locale === "ar" ? "مجموعة" : "Cohort", detail: row.values.name })),
        ...sessions.map((row) => ({ id: row.clientMutationId, type: locale === "ar" ? "جلسة" : "Session", detail: row.values.title })),
        ...activities.map((row) => ({ id: row.clientMutationId, type: locale === "ar" ? "نشاط" : "Activity", detail: row.values.name })),
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
        ...beneficiaries.map((row) => ({
          id: row.clientMutationId,
          type: locale === "ar" ? "تسجيل مستفيد" : "Beneficiary registration",
          detail: row.values.firstName + " " + row.values.lastName,
        })),
        ...projects.map((row) => ({
          id: row.clientMutationId,
          type: locale === "ar" ? "إنشاء مشروع" : "Project creation",
          detail: row.values.code + " — " + row.values.name,
        })),
        ...courses.map((row) => ({
          id: row.clientMutationId,
          type: locale === "ar" ? "إنشاء كورس" : "Course creation",
          detail: row.values.code + " — " + row.values.name,
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
