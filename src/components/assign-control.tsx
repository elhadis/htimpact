"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { offlineDb, queueModeEnabled } from "@/lib/offline/db";
import { assignBeneficiary } from "@/server/mutations";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";

export function AssignControl({
  projectId,
  projectName,
  people,
}: {
  projectId: string;
  projectName: string;
  people: { id: string; name: string; code: string }[];
}) {
  const t = useTranslations();
  const router = useRouter();
  const [beneficiaryId, setBeneficiaryId] = useState(people[0]?.id ?? "");
  const [pending, setPending] = useState(false);
  const person = people.find((item) => item.id === beneficiaryId);

  async function onAssign() {
    if (!person) return;
    const mutation = {
      projectId,
      beneficiaryId: person.id,
      beneficiaryName: person.name,
      projectName,
      op: "ASSIGN" as const,
      note: null,
      baseUpdatedAt: null,
      baseNotes: null,
      clientMutationId: crypto.randomUUID(),
    };
    if (queueModeEnabled()) {
      await offlineDb.assignmentQueue.put(mutation);
      toast.success(t("sync.assignmentQueued"));
      return;
    }
    setPending(true);
    try {
      const result = await assignBeneficiary(mutation);
      if (!result.ok) {
        toast.error(t(`errors.${result.error}`));
        return;
      }
      if (result.result.result === "conflict") toast.message(t("sync.needsReview"));
      else toast.success(t("common.saved"));
      router.refresh();
    } catch {
      await offlineDb.assignmentQueue.put(mutation);
      toast.success(t("sync.assignmentQueued"));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <NativeSelect value={beneficiaryId} onChange={(event) => setBeneficiaryId(event.target.value)}>
        {people.map((item) => (
          <option key={item.id} value={item.id}>
            {item.code} · {item.name}
          </option>
        ))}
      </NativeSelect>
      <Button type="button" onClick={() => void onAssign()} disabled={pending || people.length === 0}>
        {t("beneficiaries.assign")}
      </Button>
    </div>
  );
}
