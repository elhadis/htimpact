"use client";

export type SyncStatus = {
  attemptedAt: string;
  lastSuccessfulAt: string | null;
  outcome: "success" | "incomplete" | "conflicts";
};
export function readSyncScope(): string | null {
  try { return localStorage.getItem("ht-active-scope"); } catch { return null; }
}
export function readSyncStatus(): SyncStatus | null {
  try {
    const scope = readSyncScope();
    if (!scope) return null;
    const value = JSON.parse(localStorage.getItem(`ht-sync-status:${scope}`) ?? "null");
    if (!value || !["success", "incomplete", "conflicts"].includes(value.outcome) || !Number.isFinite(Date.parse(value.attemptedAt))) return null;
    return { attemptedAt: value.attemptedAt, outcome: value.outcome, lastSuccessfulAt: value.lastSuccessfulAt && Number.isFinite(Date.parse(value.lastSuccessfulAt)) ? value.lastSuccessfulAt : null };
  } catch { return null; }
}
// Metadata only: never store personal records or credentials in this log.
export function recordSyncOutcome(outcome: SyncStatus["outcome"], expectedScope: string | null) {
  try {
    const scope = readSyncScope();
    if (!scope || scope !== expectedScope) return;
    const attemptedAt = new Date().toISOString();
    const previous = readSyncStatus();
    const status: SyncStatus = { attemptedAt, outcome, lastSuccessfulAt: outcome === "success" ? attemptedAt : previous?.lastSuccessfulAt ?? null };
    localStorage.setItem(`ht-sync-status:${scope}`, JSON.stringify(status));
    window.dispatchEvent(new Event("ht-sync-status"));
  } catch { /* Monitoring must not interrupt the existing synchronization flow. */ }
}
