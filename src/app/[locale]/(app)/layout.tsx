import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { currentActor } from "@/lib/center-scope";
import { OfflineBoundary } from "@/components/offline-boundary";
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
  const actor = await currentActor();
  if (!actor?.active) redirect(`/${locale}/login`);
  return (
    <OfflineBoundary scope={`${actor.id}:${actor.centerId ?? "global"}:${actor.role.key}`} locale={locale}>
    <AppShell
      locale={locale}
      user={{
        id: actor.id,
        name: session.user.name ?? "",
        email: session.user.email ?? "",
        role: actor.role.key as AppRole,
        isDemo: session.user.isDemo,
      }}
    >
      {children}
    </AppShell>
    </OfflineBoundary>
  );
}
