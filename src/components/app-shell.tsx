"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { signOut } from "next-auth/react";
import {
  ClipboardCheck,
  FolderKanban,
  GraduationCap,
  LayoutDashboard,
  Menu,
  RefreshCw,
  ScrollText,
  Users,
  UserRound,
  UsersRound,
  CalendarDays,
  FileBarChart,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { can, type AppRole, type Resource } from "@/lib/rbac";
import { offlineDb, queueModeEnabled } from "@/lib/offline/db";
import { syncQueued, saveParticipation, enrollBeneficiary } from "@/server/mutations";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const links: { href: string; key: string; icon: typeof LayoutDashboard; resource?: Resource }[] = [
  { href: "/dashboard", key: "dashboard", icon: LayoutDashboard },
  { href: "/projects", key: "projects", icon: FolderKanban, resource: "projects" },
  { href: "/beneficiaries", key: "beneficiaries", icon: Users, resource: "beneficiaries" },
  { href: "/courses", key: "courses", icon: GraduationCap, resource: "courses" },
  { href: "/cohorts", key: "cohorts", icon: UsersRound, resource: "cohorts" },
  { href: "/sessions", key: "sessions", icon: CalendarDays, resource: "sessions" },
  { href: "/attendance", key: "attendance", icon: ClipboardCheck, resource: "attendance" },
  { href: "/staff", key: "staff", icon: UserRound, resource: "staff" },
  { href: "/reports", key: "reports", icon: FileBarChart, resource: "reports" },
  { href: "/audit", key: "audit", icon: ScrollText, resource: "audit" },
  { href: "/sync", key: "sync", icon: RefreshCw, resource: "sync" },
];

export function AppShell({
  locale,
  user,
  children,
}: {
  locale: string;
  user: { name: string; email: string; role: AppRole; isDemo: boolean };
  children: React.ReactNode;
}) {
  const t = useTranslations();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [online, setOnline] = useState(true);
  const [queued, setQueued] = useState(0);
  const [queueMode, setQueueMode] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const syncInProgress = useRef(false);

  async function refreshQueue() {
    const [attendance, assignments, participation, enrollments] = await Promise.all([
      offlineDb.attendanceQueue.count(),
      offlineDb.assignmentQueue.count(),
      offlineDb.participationQueue.count(),
      offlineDb.enrollmentQueue.count(),
    ]);
    setQueued(attendance + assignments + participation + enrollments);
    setOnline(navigator.onLine);
    setQueueMode(localStorage.getItem("ht-queue-mode") === "1");
  }

  async function flush() {
    if (!navigator.onLine || syncInProgress.current) return;
    syncInProgress.current = true;
    let attendance: Awaited<ReturnType<typeof offlineDb.attendanceQueue.toArray>>;
    let assignments: Awaited<ReturnType<typeof offlineDb.assignmentQueue.toArray>>;
    let participation: Awaited<ReturnType<typeof offlineDb.participationQueue.toArray>>;
    let enrollments: Awaited<ReturnType<typeof offlineDb.enrollmentQueue.toArray>>;
    try {
      [attendance, assignments, participation, enrollments] = await Promise.all([
        offlineDb.attendanceQueue.toArray(),
        offlineDb.assignmentQueue.toArray(),
        offlineDb.participationQueue.toArray(),
        offlineDb.enrollmentQueue.toArray(),
      ]);
    } catch {
      syncInProgress.current = false;
      toast.error(t("errors.syncFailed"));
      return;
    }
    if (attendance.length + assignments.length + participation.length + enrollments.length === 0) {
      syncInProgress.current = false;
      return;
    }
    setSyncing(true);
    try {
      const result = await syncQueued({
        attendance: attendance.map((row) => ({ ...row, source: "offline" as const })),
        assignments,
      });
      if (!result.ok) {
        toast.error(t("errors.syncFailed"));
        return;
      }
      await offlineDb.attendanceQueue.bulkDelete(result.attendance.filter((row) => row.result === "applied" || row.result === "noop" || row.result === "conflict").map((row) => row.clientMutationId));
      await offlineDb.assignmentQueue.bulkDelete(result.assignments.filter((row) => row.result === "applied" || row.result === "noop" || row.result === "conflict").map((row) => row.clientMutationId));
      let participationFailed = 0;
      for (const mutation of participation) {
        const saved = await saveParticipation({ activityId: mutation.activityId, rows: mutation.rows });
        if (saved.ok) await offlineDb.participationQueue.delete(mutation.clientMutationId);
        else participationFailed++;
      }
      let enrollmentFailed = 0;
      for (const mutation of enrollments) {
        const saved = await enrollBeneficiary({ cohortId: mutation.cohortId, beneficiaryId: mutation.beneficiaryId });
        if (saved.ok) await offlineDb.enrollmentQueue.delete(mutation.clientMutationId);
        else enrollmentFailed++;
      }
      const conflicts = [...result.attendance, ...result.assignments].filter((row) => row.result === "conflict").length;
      const rejected = [...result.attendance, ...result.assignments].filter((row) => row.result === "rejected").length;
      if (participationFailed || enrollmentFailed || rejected) toast.error(t("errors.syncFailed"));
      else toast.success(conflicts ? t("sync.syncedWithConflicts") : t("sync.synced"));
    } catch {
      toast.error(t("errors.syncFailed"));
    } finally {
      syncInProgress.current = false;
      setSyncing(false);
      await refreshQueue();
    }
  }

  useEffect(() => {
    const boot = window.setTimeout(() => {
      void refreshQueue();
    }, 0);
    const onOnline = () => {
      setOnline(true);
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const timer = window.setInterval(() => void refreshQueue(), 4000);
    return () => {
      window.clearTimeout(boot);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.clearInterval(timer);
    };
    // flush identity is stable enough for this session widget
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleQueue() {
    const next = !queueMode;
    localStorage.setItem("ht-queue-mode", next ? "1" : "0");
    setQueueMode(next);

  }

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
      {links
        .filter((link) => !link.resource || can(user.role, link.resource, "read"))
        .map((link) => {
          const active = link.href === "/dashboard" ? pathname === link.href : pathname.startsWith(link.href);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm",
                active ? "bg-white/15 text-white" : "text-white/75 hover:bg-white/10 hover:text-white",
              )}
            >
              <Icon className="size-4" />
              {t(`nav.${link.key}`)}
            </Link>
          );
        })}
    </nav>
  );

  return (
    <div className="min-h-dvh bg-background md:grid md:grid-cols-[16.5rem_1fr]">
      <aside className="hidden bg-navy text-white md:flex md:flex-col">
        <div className="px-5 pt-6 pb-4">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-teal-200 uppercase">{t("common.company")}</p>
          <p className="mt-2 text-lg font-semibold leading-6">{t("common.appName")}</p>
        </div>
        {nav}
        <p className="px-5 py-4 text-xs text-white/50">{t("common.company")}</p>
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b bg-card/95 px-3 py-3 backdrop-blur sm:px-6">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="md:hidden" aria-label={t("common.menu")}>
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="start" aria-label={t("common.menu")}>
              <div className="px-5 pt-5">
                <p className="text-[11px] font-semibold tracking-[0.18em] text-teal-200 uppercase">{t("common.company")}</p>
                <p className="mt-2 font-semibold">{t("common.appName")}</p>
              </div>
              {nav}
            </SheetContent>
          </Sheet>
          <div className="min-w-0 flex-1 md:hidden">
            <p className="truncate text-sm font-semibold text-primary">{t("common.appName")}</p>
          </div>
          <div className="ms-auto flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={toggleQueue}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
                queueMode || !online ? "border-amber-300 bg-amber-50 text-amber-900" : "bg-card text-muted-foreground",
              )}
            >
              {online && !queueMode ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
              {queueMode ? t("sync.queueOn") : online ? t("common.online") : t("common.offline")}
              {queued > 0 ? <span className="font-semibold text-primary">{queued}</span> : null}
            </button>
            {queued > 0 ? (
              <Button type="button" size="sm" variant="teal" onClick={() => void flush()} disabled={syncing || !online}>
                {t("common.syncNow")}
              </Button>
            ) : null}
            <LanguageSwitcher />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="max-w-40 truncate">
                  {user.name}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  <p>{t(`roles.${user.role}`)}</p>
                  {user.isDemo ? <p className="mt-1 text-amber-800">{t("auth.demoChip")}</p> : null}
                </div>
                <DropdownMenuItem
                  onSelect={() => signOut({ callbackUrl: `/${locale}/login` })}
                >
                  {t("common.signOut")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
