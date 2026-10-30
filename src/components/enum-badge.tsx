"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";

const tones: Record<string, "navy" | "teal" | "gray" | "amber" | "red"> = {
  ACTIVE: "teal",
  DRAFT: "gray",
  ON_HOLD: "amber",
  COMPLETED: "navy",
  ARCHIVED: "gray",
  EDUCATIONAL: "teal",
  NON_EDUCATIONAL: "navy",
  PRESENT: "teal",
  ABSENT: "red",
  LATE: "amber",
  EXCUSED: "navy",
  CREATE: "teal",
  UPDATE: "navy",
  DELETE: "red",
  active: "teal",
  withdrawn: "amber",
  completed: "navy",
  pending: "amber",
  kept_server: "navy",
  kept_local: "teal",
};

export function EnumBadge({ value }: { value: string }) {
  const t = useTranslations("enums");
  return <Badge tone={tones[value] ?? "gray"}>{t(value)}</Badge>;
}
