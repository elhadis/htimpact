"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { ROLES } from "@/lib/rbac";
import { staffSchema, staffUpdateSchema } from "@/lib/validators";
import { createStaff, updateStaff } from "@/server/mutations";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Field } from "@/components/chrome";
import type { z } from "zod";

type CreateValues = z.infer<typeof staffSchema>;
type EditValues = z.infer<typeof staffUpdateSchema>;

export function StaffForm({
  mode,
  userId,
  defaults,
  projects,
}: {
  mode: "create" | "edit";
  userId?: string;
  defaults: CreateValues | EditValues;
  projects: { id: string; name: string; code: string }[];
}) {
  const t = useTranslations();
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(defaults.projectIds ?? []);
  const form = useForm<CreateValues | EditValues>({
    resolver: zodResolver(mode === "create" ? staffSchema : staffUpdateSchema) as Resolver<CreateValues | EditValues>,
    defaultValues: defaults,
  });

  async function onSubmit(values: CreateValues | EditValues) {
    const payload = { ...values, projectIds: selected };
    const result = mode === "create" ? await createStaff(payload) : await updateStaff(userId ?? "", payload);
    if (!result.ok) {
      toast.error(t(`errors.${result.error}`));
      return;
    }
    toast.success(t("common.saved"));
    router.push("/staff");
    router.refresh();
  }

  return (
    <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("staff.name")}>
          <Input {...form.register("name")} />
        </Field>
        <Field label={t("staff.email")}>
          <Input type="email" {...form.register("email")} />
        </Field>
        {mode === "create" ? (
          <Field label={t("staff.password")} className="sm:col-span-2">
            <Input type="password" autoComplete="new-password" {...form.register("password")} />
            <span className="text-xs text-muted-foreground">{t("staff.passwordHelp")}</span>
          </Field>
        ) : null}
        <Field label={t("staff.role")}>
          <Controller
            control={form.control}
            name="role"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger aria-label={t("staff.role")}>
                  <span>{t(`roles.${field.value}`)}</span>
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {t(`roles.${role}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
        <Field label={t("staff.title")}>
          <Input {...form.register("title")} />
        </Field>
        <Field label={t("staff.phone")}>
          <Input {...form.register("phone")} />
        </Field>
        {mode === "edit" ? (
          <label className="flex items-center gap-3 pt-7 text-sm">
            <Checkbox
              checked={Boolean(form.watch("active"))}
              onCheckedChange={(value) => form.setValue("active", value === true)}
            />
            {t("staff.active")}
          </label>
        ) : null}
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t("staff.projects")}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {projects.map((project) => (
            <label key={project.id} className="flex items-center gap-3 rounded-lg border bg-card px-3 py-3 text-sm">
              <Checkbox
                checked={selected.includes(project.id)}
                onCheckedChange={(value) =>
                  setSelected((current) =>
                    value === true ? [...current, project.id] : current.filter((id) => id !== project.id),
                  )
                }
              />
              {project.name}
            </label>
          ))}
        </div>
      </fieldset>
      <Button type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? t("common.saving") : t("common.save")}
      </Button>
    </form>
  );
}
