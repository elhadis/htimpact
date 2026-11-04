"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { beneficiarySchema, genders, type BeneficiaryInput } from "@/lib/validators";
import { createBeneficiary, updateBeneficiary } from "@/server/mutations";
import { Button } from "@/components/ui/button";
import { offlineDb, queueModeEnabled } from "@/lib/offline/db";
import { Checkbox } from "@/components/ui/checkbox";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Field } from "@/components/chrome";

export function BeneficiaryForm({
  mode,
  beneficiaryId,
  defaults,
  projects,
}: {
  mode: "create" | "edit";
  beneficiaryId?: string;
  defaults: BeneficiaryInput;
  projects: { id: string; name: string; code: string }[];
}) {
  const t = useTranslations();
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(defaults.projectIds);
  const form = useForm<BeneficiaryInput>({
    resolver: zodResolver(beneficiarySchema) as Resolver<BeneficiaryInput>,
    defaultValues: defaults,
  });

  async function onSubmit(values: BeneficiaryInput) {
    const payload = { ...values, projectIds: selected };
    if (mode === "create") {
      const pending = { clientMutationId: crypto.randomUUID(), values: payload };
      const queue = async () => {
        try {
          await offlineDb.beneficiaryQueue.put(pending);
          toast.success(t("common.saved"));
        } catch {
          toast.error(t("errors.syncFailed"));
        }
      };
      if (queueModeEnabled()) {
        await queue();
        return;
      }
      try {
        const result = await createBeneficiary(payload);
        if (!result.ok) {
          toast.error(t(`errors.${result.error}`));
          return;
        }
        toast.success(t("common.saved"));
        router.push(`/beneficiaries/${result.id}`);
        router.refresh();
      } catch {
        await queue();
      }
      return;
    }
    const result = await updateBeneficiary(beneficiaryId ?? "", payload);
    if (!result.ok) {
      toast.error(t(`errors.${result.error}`));
      return;
    }
    toast.success(t("common.saved"));
    router.push(`/beneficiaries/${result.id}`);
    router.refresh();
  }

  return (
    <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("beneficiaries.firstName")}>
          <Input {...form.register("firstName")} />
        </Field>
        <Field label={t("beneficiaries.lastName")}>
          <Input {...form.register("lastName")} />
        </Field>
        <Field label={t("beneficiaries.gender")}>
          <NativeSelect {...form.register("gender")}>
            {genders.map((gender) => (
              <option key={gender} value={gender}>
                {t(`enums.${gender}`)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={t("beneficiaries.birthDate")}>
          <Input type="date" {...form.register("dateOfBirth")} />
        </Field>
        <Field label={t("beneficiaries.phone")}>
          <Input {...form.register("phone")} />
        </Field>
        <Field label={t("beneficiaries.nationalId")}>
          <Input {...form.register("nationalId")} />
        </Field>
        <Field label={t("beneficiaries.community")} className="sm:col-span-2">
          <Input {...form.register("community")} />
        </Field>
      </div>
      <Field label={t("beneficiaries.notes")}>
        <Textarea {...form.register("notes")} />
      </Field>
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">{t("beneficiaries.projects")}</legend>
        <p className="text-sm text-muted-foreground">{t("beneficiaries.projectsHelp")}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {projects.map((project) => {
            const checked = selected.includes(project.id);
            return (
              <label key={project.id} className="flex items-center gap-3 rounded-lg border bg-card px-3 py-3">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(value) => {
                    setSelected((current) =>
                      value === true ? [...current, project.id] : current.filter((id) => id !== project.id),
                    );
                  }}
                />
                <span>
                  <span className="block text-sm font-medium">{project.name}</span>
                  <span className="text-xs text-muted-foreground">{project.code}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <Button type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? t("common.saving") : t("common.save")}
      </Button>
    </form>
  );
}
