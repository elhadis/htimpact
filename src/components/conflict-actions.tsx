"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { resolveSyncConflict } from "@/server/mutations";
import { Button } from "@/components/ui/button";

export function ConflictActions({ id }: { id: string }) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function choose(choice: "server" | "local") {
    setPending(true);
    const result = await resolveSyncConflict(id, choice);
    setPending(false);
    if (!result.ok) {
      toast.error(t(`errors.${result.error}`));
      return;
    }
    toast.success(t("common.saved"));
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => void choose("server")}>
        {t("sync.keepServer")}
      </Button>
      <Button type="button" size="sm" variant="teal" disabled={pending} onClick={() => void choose("local")}>
        {t("sync.keepField")}
      </Button>
    </div>
  );
}
