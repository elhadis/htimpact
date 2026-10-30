import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import type { AppRole } from "@/lib/rbac";

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user?.id || session.user.active === false) redirect(`/${locale}/login`);
  return (
    <AppShell
      locale={locale}
      user={{
        name: session.user.name ?? "",
        email: session.user.email ?? "",
        role: session.user.role as AppRole,
        isDemo: session.user.isDemo,
      }}
    >
      {children}
    </AppShell>
  );
}
