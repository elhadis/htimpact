import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { isDemoLoginEnabled } from "@/lib/demo";
import { prisma } from "@/lib/prisma";
import { LanguageSwitcher } from "@/components/language-switcher";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (session?.user?.active) redirect(`/${locale}/dashboard`);
  const t = await getTranslations();
  let demoEmail: string | null = null;
  if (isDemoLoginEnabled()) {
    try {
      const demo = await prisma.user.findFirst({
        where: { isDemo: true, active: true },
        select: { email: true },
      });
      demoEmail = demo?.email ?? null;
    } catch {
      demoEmail = null;
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.15fr_0.85fr]">
      <section className="hidden flex-col justify-between bg-navy px-12 py-12 text-white lg:flex">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-teal-200 uppercase">{t("common.company")}</p>
          <h1 className="mt-8 max-w-lg text-5xl leading-tight font-semibold">{t("common.appName")}</h1>
          <p className="mt-6 max-w-md text-lg leading-8 text-white/80">{t("auth.tagline")}</p>
        </div>
        <ul className="max-w-md space-y-3 text-sm leading-6 text-white/75">
          <li>{t("auth.point1")}</li>
          <li>{t("auth.point2")}</li>
          <li>{t("auth.point3")}</li>
        </ul>
      </section>
      <section className="flex flex-col px-5 py-8 sm:px-10">
        <div className="mb-8 flex items-center justify-between gap-3">
          <div className="lg:hidden">
            <p className="text-xs font-semibold tracking-[0.16em] text-teal uppercase">{t("common.company")}</p>
            <p className="text-lg font-semibold text-primary">{t("common.appName")}</p>
          </div>
          <LanguageSwitcher />
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
          <h2 className="text-2xl font-semibold text-primary">{t("auth.welcome")}</h2>
          {isDemoLoginEnabled() ? (
            <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
              <p className="font-semibold">{t("auth.demoTitle")}</p>
              <p className="mt-1">{t("auth.demoBody")}</p>
              {demoEmail ? <p className="mt-2 font-medium">{demoEmail}</p> : null}
            </div>
          ) : null}
          <div className="mt-6 rounded-2xl border bg-card p-5 shadow-[0_10px_30px_rgba(14,42,71,0.05)] sm:p-6">
            <LoginForm />
          </div>
        </div>
      </section>
    </div>
  );
}
