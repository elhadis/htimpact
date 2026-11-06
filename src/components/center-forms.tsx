"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { saveCenter, requestTransfer, reviewTransfer } from "@/server/centers";
import { offlineDb, queueModeEnabled } from "@/lib/offline/db";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/chrome";
import type { z } from "zod";
import { centerSchema, transferSchema } from "@/lib/validators";

type CenterValues = z.infer<typeof centerSchema>;
export function CenterForm({ defaults, projects, managers }: {
  defaults?: CenterValues;
  projects: { id: string; name: string }[];
  managers: { id: string; name: string }[];
}) {
  const t = useTranslations();
  const router = useRouter();
  const [values, setValues] = useState<CenterValues>(defaults ?? { id: crypto.randomUUID(), code: "", name: "", location: "", active: true, projectIds: [], managerIds: [] });
  const [busy, setBusy] = useState(false);
  function toggle(key: "projectIds" | "managerIds", id: string) {
    setValues((current) => ({ ...current, [key]: current[key].includes(id) ? current[key].filter((item) => item !== id) : [...current[key], id] }));
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = centerSchema.safeParse(values);
    if (!parsed.success) { toast.error(t("errors.invalid")); return; }
    setBusy(true);
    const queue = async () => { await offlineDb.centerQueue.put({ clientMutationId: values.id!, values: parsed.data }); toast.success(t("sync.queued")); };
    try {
      if (queueModeEnabled()) { await queue(); return; }
      const result = await saveCenter(parsed.data);
      if (!result.ok) { toast.error(t(`errors.${result.error}`)); return; }
      toast.success(t("common.saved")); router.push(`/centers/${result.id}`); router.refresh();
    } catch { try { await queue(); } catch { toast.error(t("errors.syncFailed")); } }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label={t("projects.code")}><Input required value={values.code} onChange={(e) => setValues({ ...values, code: e.target.value })} /></Field>
      <Field label={t("centers.name")}><Input required value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} /></Field>
      <Field label={t("projects.location")}><Input value={values.location ?? ""} onChange={(e) => setValues({ ...values, location: e.target.value })} /></Field>
      <label className="flex items-center gap-2"><input type="checkbox" checked={values.active} onChange={(e) => setValues({ ...values, active: e.target.checked })} />{t("staff.active")}</label>
    </div>
    {(["projectIds", "managerIds"] as const).map((key) => <fieldset key={key} className="space-y-3">
      <legend className="font-medium">{t(key === "projectIds" ? "centers.projects" : "centers.managers")}</legend>
      <div className="grid gap-2 sm:grid-cols-2">{(key === "projectIds" ? projects : managers).map((item) => <label className="flex items-center gap-3 rounded-xl border bg-card p-3" key={item.id}>
        <input type="checkbox" checked={values[key].includes(item.id)} onChange={() => toggle(key, item.id)} />{item.name}
      </label>)}</div>
      {key === "managerIds" && <p className="text-xs text-muted-foreground">{t("centers.managerHelp")}</p>}
    </fieldset>)}
    <Button disabled={busy}>{t("common.save")}</Button>
  </form>;
}

export function TransferForm({ people, destinations }: {
  people: { id: string; name: string; code: string; centerId: string | null }[];
  destinations: { id: string; name: string }[];
}) {
  const t = useTranslations();
  const router = useRouter();
  const [personId, setPersonId] = useState(people[0]?.id ?? "");
  const [destination, setDestination] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const person = people.find((row) => row.id === personId);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const values: z.infer<typeof transferSchema> = { id: crypto.randomUUID(), beneficiaryId: personId, fromCenterId: person?.centerId ?? "", toCenterId: destination, reason };
    if (!transferSchema.safeParse(values).success) { toast.error(t("errors.invalid")); return; }
    const queue = async () => { await offlineDb.transferQueue.put({ clientMutationId: values.id, values }); toast.success(t("sync.queued")); };
    setBusy(true);
    try {
      if (queueModeEnabled()) { await queue(); return; }
      const result = await requestTransfer(values);
      if (!result.ok) toast.error(t(`errors.${result.error}`));
      else { toast.success(t("common.saved")); router.refresh(); }
    } catch { try { await queue(); } catch { toast.error(t("errors.syncFailed")); } }
    finally { setBusy(false); }
  }
  return <form className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2" onSubmit={submit}>
    <Field label={t("beneficiaries.name")}><NativeSelect value={personId} onChange={(e) => { setPersonId(e.target.value); setDestination(""); }}>{people.map((row) => <option key={row.id} value={row.id}>{row.code} · {row.name}</option>)}</NativeSelect></Field>
    <Field label={t("centers.destination")}><NativeSelect required value={destination} onChange={(e) => setDestination(e.target.value)}><option value="">{t("common.select")}</option>{destinations.filter((row) => row.id !== person?.centerId).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</NativeSelect></Field>
    <Field className="sm:col-span-2" label={t("centers.reason")}><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
    <Button disabled={busy || !person?.centerId || !destination}>{t("centers.request")}</Button>
    <p className="text-xs text-muted-foreground">{t("centers.approvalHelp")}</p>
  </form>;
}

export function TransferReview({ id }: { id: string }) {
  const t = useTranslations(); const router = useRouter(); const [busy, setBusy] = useState(false);
  async function review(approve: boolean) {
    if (!navigator.onLine) { toast.error(t("centers.reviewOnline")); return; }
    setBusy(true);
    try { const result = await reviewTransfer(id, approve); if (!result.ok) toast.error(t(`errors.${result.error}`)); else { toast.success(t("common.saved")); router.refresh(); } }
    catch { toast.error(t("errors.syncFailed")); } finally { setBusy(false); }
  }
  return <div className="flex gap-2"><Button disabled={busy} onClick={() => void review(true)}>{t("centers.approve")}</Button><Button disabled={busy} variant="outline" onClick={() => void review(false)}>{t("centers.reject")}</Button></div>;
}
