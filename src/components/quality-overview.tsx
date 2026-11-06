"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { StatCard } from "@/components/chrome";
import { Button } from "@/components/ui/button";
import { PendingOfflineChanges } from "@/components/pending-offline-changes";
import { offlineDb } from "@/lib/offline/db";
import { readSyncStatus, type SyncStatus } from "@/lib/offline/sync-status";
import type { QualityData } from "@/lib/quality";

function Section({ id, title, count, children }: { id: string; title: string; count: number | null; children: React.ReactNode }) {
  return <section id={id} className="scroll-mt-24 space-y-4 rounded-xl border bg-card p-4 sm:p-5"><h2 className="flex items-center justify-between gap-3 font-semibold text-primary"><span>{title}</span><span className="rounded-full bg-secondary px-2.5 py-1 text-xs tabular-nums">{count ?? "—"}</span></h2>{children}</section>;
}

export function QualityOverview({ data, locale, centerOnly }: { data: QualityData; locale: string; centerOnly: boolean }) {
  const t = useTranslations("quality");
  const router = useRouter();
  const [online, setOnline] = useState<boolean | null>(null);
  const [local, setLocal] = useState<{ count: number; status: SyncStatus | null } | null>(null);
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  useEffect(() => {
    let active = true;
    async function load() {
      if (active) setOnline(navigator.onLine);
      try {
        const counts = await Promise.all(offlineDb.tables.filter((table) => table.name.endsWith("Queue")).map((table) => table.count()));
        if (active) { setLocal({ count: counts.reduce((sum, value) => sum + value, 0), status: readSyncStatus() }); setStorageUnavailable(false); }
      } catch { if (active) { setLocal(null); setStorageUnavailable(true); } }
    }
    void load();
    const update = () => { void load(); };
    window.addEventListener("online", update); window.addEventListener("offline", update); window.addEventListener("ht-sync-status", update);
    const timer = window.setInterval(update, 4000);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener("online", update); window.removeEventListener("offline", update); window.removeEventListener("ht-sync-status", update); };
  }, []);
  const stamp = (value: string) => `${new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value))} UTC`;
  const cards = [
    { id: "missing-center", label: t("missingCenter"), count: data.missingCenter.length },
    { id: "missing-project", label: t("missingProject"), count: data.missingProject.length },
    { id: "attendance", label: t("attendance"), count: data.incompleteAttendance.length },
    { id: "transfers", label: t("transfers"), count: data.transfers.length },
    { id: "duplicates", label: t("duplicates"), count: data.duplicates.length },
    { id: "local", label: t("localQueue"), count: local?.count ?? null },
    { id: "conflicts", label: t("conflicts"), count: data.conflictCount },
  ];
  const empty = <p className="text-sm text-muted-foreground">{t("noItems")}</p>;
  const personRows = (people: QualityData["missingCenter"]) => people.length ? <ul className="divide-y">{people.map((person) => <li key={person.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><span className="min-w-0 break-words text-sm">{person.code} · {person.name}</span><Link href={`/beneficiaries/${person.id}/edit`} className="text-sm font-medium text-teal hover:underline">{t("review")}</Link></li>)}</ul> : empty;
  return <div className="space-y-5">
    <div className="space-y-3 rounded-xl border bg-card p-4 text-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="font-medium">{t(centerOnly ? "centerScope" : "allCenters")}</p><Button variant="outline" size="sm" disabled={online !== true} onClick={() => router.refresh()}>{t("refresh")}</Button></div>
      <p className="text-muted-foreground">{t("snapshotAt")}: <time dateTime={data.capturedAt}>{stamp(data.capturedAt)}</time></p>
      <p className="text-muted-foreground">{t("lastSync")}: {local?.status?.lastSuccessfulAt ? <time dateTime={local.status.lastSuccessfulAt}>{stamp(local.status.lastSuccessfulAt)}</time> : t("notRecorded")}</p>
      <p className="text-muted-foreground">{t(online === false ? "offlineNote" : "snapshotNote")}</p>
      <p className="text-xs text-muted-foreground">{t("localNote")}</p>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{cards.map((card) => <a key={card.id} href={`#${card.id}`} className="rounded-xl outline-none transition hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ring"><StatCard label={card.label} value={card.count === null ? "—" : new Intl.NumberFormat(locale === "ar" ? "ar" : "en").format(card.count)} /></a>)}</div>
    <Section id="missing-center" title={t("missingCenter")} count={data.missingCenter.length}>{personRows(data.missingCenter)}</Section>
    <Section id="missing-project" title={t("missingProject")} count={data.missingProject.length}>{personRows(data.missingProject)}</Section>
    <Section id="attendance" title={t("attendance")} count={data.incompleteAttendance.length}>
      <p className="text-xs text-muted-foreground">{t("attendanceHelp")}</p>
      {data.incompleteAttendance.length ? <ul className="divide-y">{data.incompleteAttendance.map((session) => <li key={session.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="break-words text-sm font-medium">{session.title} · {session.cohort}</p><p className="mt-1 text-xs text-muted-foreground">{stamp(session.scheduledAt)} · {t("missingMarks", { count: session.missing })}</p></div><Link className="text-sm font-medium text-teal hover:underline" href={`/attendance/${session.id}`}>{t("review")}</Link></li>)}</ul> : empty}
    </Section>
    <Section id="transfers" title={t("transfers")} count={data.transfers.length}>
      {data.transfers.length ? <ul className="divide-y">{data.transfers.map((row) => <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="break-words text-sm font-medium">{row.person}</p><p className="mt-1 break-words text-xs text-muted-foreground">{row.from} → {row.to} · {stamp(row.createdAt)}</p></div><Link className="text-sm font-medium text-teal hover:underline" href="/transfers?status=PENDING">{t("review")}</Link></li>)}</ul> : empty}
    </Section>
    <Section id="duplicates" title={t("duplicates")} count={data.duplicates.length}>
      <p className="text-xs text-muted-foreground">{t("duplicateHelp")}</p>
      {data.duplicates.length ? <div className="space-y-3">{data.duplicates.map((group) => <article key={group.people.map((person) => person.id).join("|")} className="rounded-lg border p-3"><p className="mb-3 text-xs text-muted-foreground">{group.reasons.map((reason) => t(reason)).join(" · ")}</p><ul className="space-y-2">{group.people.map((person) => <li key={person.id}><Link className="break-words text-sm font-medium text-teal hover:underline" href={`/beneficiaries/${person.id}`}>{person.code} · {person.name}</Link></li>)}</ul></article>)}</div> : empty}
    </Section>
    <Section id="local" title={t("localQueue")} count={local?.count ?? null}>
      {storageUnavailable ? <p className="text-sm text-destructive">{t("storageUnavailable")}</p> : local ? <>
        {local.status && local.status.outcome !== "success" && <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">{t(local.status.outcome === "conflicts" ? "lastAttemptConflicts" : "lastAttemptFailed")} · {stamp(local.status.attemptedAt)}</p>}
        <PendingOfflineChanges locale={locale} />
      </> : <p className="text-sm text-muted-foreground">{t("loading")}</p>}
      <Link href="/sync" className="inline-block text-sm font-medium text-teal hover:underline">{t("openSync")}</Link>
    </Section>
    <Section id="conflicts" title={t("conflicts")} count={data.conflictCount}><p className="text-sm text-muted-foreground">{data.conflictCount ? t("conflictsHelp") : t("noItems")}</p>{data.conflictCount > 0 && <Link href="/sync" className="inline-block text-sm font-medium text-teal hover:underline">{t("openSync")}</Link>}</Section>
  </div>;
}
