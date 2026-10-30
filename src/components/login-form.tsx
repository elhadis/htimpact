"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { loginSchema } from "@/lib/validators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/chrome";
import type { z } from "zod";

type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const t = useTranslations();
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginValues) {
    setFailed(false);
    const result = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
    });
    if (!result || result.error) {
      setFailed(true);
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  const emailError = form.formState.errors.email?.message;
  const passwordError = form.formState.errors.password?.message;

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <Field label={t("auth.email")} error={emailError ? t(`validation.${emailError}`) : null}>
        <Input type="email" autoComplete="username" {...form.register("email")} />
      </Field>
      <Field label={t("auth.password")} error={passwordError ? t(`validation.${passwordError}`) : null}>
        <Input type="password" autoComplete="current-password" {...form.register("password")} />
      </Field>
      {failed ? <p className="text-sm text-destructive">{t("auth.invalid")}</p> : null}
      <Button type="submit" className="w-full" size="lg" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? t("common.saving") : t("auth.submit")}
      </Button>
    </form>
  );
}
