"use client";

import { useForm, useFieldArray, Controller } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { projectSchema, projectStatuses, type ProjectInput } from "@/lib/validators";
import { metricsForType } from "@/lib/progress";
import { createProject, updateProject } from "@/server/mutations";
import { Button } from "@/components/ui/button";
import { offlineDb, queueModeEnabled } from "@/lib/offline/db";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Field } from "@/components/chrome";

const metricUnits: Record<string, string> = {
  beneficiaries: "people",
  sessions: "sessions",
  attendance_rate: "percent",
  activities: "activities",
  participation: "logs",
};

export function ProjectForm({
  mode,
  projectId,
  defaults,
}: {
  mode: "create" | "edit";
  projectId?: string;
  defaults: ProjectInput;
}) {
  const t = useTranslations();
  const router = useRouter();
  const form = useForm<ProjectInput>({
    resolver: zodResolver(projectSchema) as Resolver<ProjectInput>,
    defaultValues: defaults,
  });
  const targets = useFieldArray({ control: form.control, name: "targets" });
  const type = form.watch("type");
  const allowed = metricsForType(type);

  function show(message?: string) {
    if (!message) return null;
    return t.has(`validation.${message}`) ? t(`validation.${message}`) : message;
  }

  async function onSubmit(values: ProjectInput) {
    if (mode === "create") {
      const pending = { clientMutationId: crypto.randomUUID(), values };
      const queue = async () => {
        try {
          await offlineDb.projectQueue.put(pending);
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
        const result = await createProject(values);
        if (!result.ok) {
          toast.error(t.has(`errors.${result.error}`) ? t(`errors.${result.error}`) : t("errors.invalid"));
          return;
        }
        toast.success(t("common.saved"));
        router.push(`/projects/${result.id}`);
        router.refresh();
      } catch {
        await queue();
      }
      return;
    }
    const result = await updateProject(projectId ?? "", values);
    if (!result.ok) {
      toast.error(t.has(`errors.${result.error}`) ? t(`errors.${result.error}`) : t("errors.invalid"));
      return;
    }
    toast.success(t("common.saved"));
    router.push(`/projects/${result.id}`);
    router.refresh();
  }

  return (
    <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("projects.code")} error={show(form.formState.errors.code?.message)}>
          <Input {...form.register("code")} />
        </Field>
        <Field label={t("projects.name")} error={show(form.formState.errors.name?.message)}>
          <Input {...form.register("name")} />
        </Field>
        <Field label={t("projects.type")}>
          <Controller
            control={form.control}
            name="type"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger aria-label={t("projects.type")}>
                  <span>{t(`enums.${field.value}`)}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EDUCATIONAL">{t("enums.EDUCATIONAL")}</SelectItem>
                  <SelectItem value="NON_EDUCATIONAL">{t("enums.NON_EDUCATIONAL")}</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </Field>
        <Field label={t("projects.status")}>
          <NativeSelect {...form.register("status")}>
            {projectStatuses.map((status) => (
              <option key={status} value={status}>
                {t(`enums.${status}`)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={t("projects.start")} error={show(form.formState.errors.startDate?.message)}>
          <Input type="date" {...form.register("startDate")} />
        </Field>
        <Field label={t("projects.end")} error={show(form.formState.errors.endDate?.message)}>
          <Input type="date" {...form.register("endDate")} />
        </Field>
        <Field label={t("projects.location")}>
          <Input {...form.register("location")} />
        </Field>
        <Field label={t("projects.donor")}>
          <Input {...form.register("donor")} />
        </Field>
      </div>
      <Field label={t("projects.description")}>
        <Textarea {...form.register("description")} />
      </Field>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-primary">{t("projects.targets")}</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              targets.append({
                metricKey: allowed[0],
                label: t(`metrics.${allowed[0]}`),
                targetValue: String(allowed[0]) === "attendance_rate" ? 80 : 10,
                unit: t(`units.${metricUnits[allowed[0]]}`),
              })
            }
          >
            {t("projects.addTarget")}
          </Button>
        </div>
        {targets.fields.map((field, index) => (
          <div key={field.id} className="grid gap-3 rounded-xl border bg-card p-3 sm:grid-cols-4">
            <Field label={t("projects.metric")}>
              <NativeSelect {...form.register(`targets.${index}.metricKey`)}>
                {allowed.map((metric) => (
                  <option key={metric} value={metric}>
                    {t(`metrics.${metric}`)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label={t("projects.targetLabel")}>
              <Input {...form.register(`targets.${index}.label`)} />
            </Field>
            <Field label={t("projects.targetValue")}>
              <Input type="number" min={1} {...form.register(`targets.${index}.targetValue`)} />
            </Field>
            <Field label={t("projects.unit")}>
              <Input {...form.register(`targets.${index}.unit`)} />
            </Field>
            {targets.fields.length > 1 ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => targets.remove(index)}>
                {t("common.remove")}
              </Button>
            ) : null}
          </div>
        ))}
        {form.formState.errors.targets?.message ? (
          <p className="text-sm text-destructive">{show(form.formState.errors.targets.message)}</p>
        ) : null}
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? t("common.saving") : t("common.save")}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          {t("common.cancel")}
        </Button>
      </div>
    </form>
  );
}
