import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { dashboardData } from "@/lib/queries";
import { currentActor } from "@/lib/center-scope";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/format";
import {
  Activity, BookOpen, CalendarCheck, ClipboardCheck, FolderKanban,
  GraduationCap, Plus, Users, UserRound, ArrowUpRight, Clock3,
} from "lucide-react";

const colors = ["#2789f5", "#11b89b", "#9275eb", "#f26799", "#f6a642"];
const backgrounds = ["#eaf3ff", "#e7faf5", "#f2edff", "#fff0f5", "#fff6e8"];

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const actor = await currentActor();
  if (!actor?.active) redirect(`/${locale}/login`);
  const role = actor.role.key;
  const [data, courseCount, staffCount, upcoming, projectCounts, activityCount, centerCount, pendingTransfers] = await Promise.all([
    dashboardData(),
    prisma.course.count(),
    prisma.user.count({ where: { active: true } }),
    prisma.session.findMany({
      where: { scheduledAt: { gte: new Date() } },
      orderBy: { scheduledAt: "asc" },
      take: 3,
      select: { id: true, title: true, scheduledAt: true, location: true },
    }),
    prisma.project.findMany({
      where: { status: { in: ["ACTIVE", "ON_HOLD"] } },
      select: { id: true, name: true, _count: { select: { beneficiaries: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.activity.count(),
    can(role, "centers", "read") ? prisma.center.count() : 0,
    can(role, "transfers", "read") ? prisma.centerTransfer.count({ where: { status: "PENDING" } }) : 0,
  ]);

  const ar = locale === "ar";
  const heading = actor?.centerId ? `${ar ? "مرحباً،" : "Welcome,"} ${actor.name}` : ar ? "مرحباً بعودتك، HT Digital" : "Welcome back, HT Digital";
  const subtitle = ar ? "نظرة عامة على مشاريعك وأثرها" : "Here is an overview of your projects and impact.";
  const metrics = [
    { label: ar ? "إجمالي المستفيدين" : "Total Beneficiaries", href: "/beneficiaries", value: data.beneficiaryCount, icon: Users, color: "#2789f5", bg: "#eaf3ff" },
    { label: ar ? "المشاريع النشطة" : "Active Projects", href: "/projects?status=active", value: data.activeProjects, icon: FolderKanban, color: "#11b89b", bg: "#e7faf5" },
    { label: ar ? "الدورات والأنشطة" : "Active Courses / Activities", href: "/courses?view=all", value: courseCount + activityCount, icon: BookOpen, color: "#e6a52d", bg: "#fff6e8" },
    { label: ar ? "أعضاء الفريق" : "Staff Members", href: "/staff?active=1", value: staffCount, icon: UserRound, color: "#9275eb", bg: "#f2edff" },
    { label: ar ? "سجلات الحضور" : "Present / Late Records", href: "/attendance/records?status=positive", value: data.attendancePresent, icon: ClipboardCheck, color: "#11b89b", bg: "#e7faf5" },
    { label: ar ? "سجلات الغياب" : "Absence Records", href: "/attendance/records?status=ABSENT", value: data.attendanceAbsent, icon: CalendarCheck, color: "#f26799", bg: "#fff0f5" },
    ...(can(role, "centers", "read") ? [{ label: ar ? "المراكز" : "Centers", href: "/centers", value: centerCount, icon: FolderKanban, color: "#11b89b", bg: "#e7faf5" }] : []),
    ...(can(role, "transfers", "read") ? [{ label: ar ? "طلبات النقل المعلقة" : "Pending Transfers", href: "/transfers?status=PENDING", value: pendingTransfers, icon: Users, color: "#e6a52d", bg: "#fff6e8" }] : []),
  ].filter((metric) => !metric.href.startsWith("/staff") || can(role, "staff", "read"));
  const totalLinked = projectCounts.reduce((sum, project) => sum + project._count.beneficiaries, 0);
  const segments = projectCounts.slice(0, 5).map((project, index) => {
    const start = totalLinked ? projectCounts.slice(0, index).reduce((sum, row) => sum + row._count.beneficiaries, 0) / totalLinked * 100 : 0;
    const end = start + (totalLinked ? project._count.beneficiaries / totalLinked * 100 : 0);
    return { ...project, color: colors[index], start, end };
  });
  const donut = segments.length && totalLinked
    ? `conic-gradient(${segments.map((segment) => `${segment.color} ${segment.start}% ${segment.end}%`).join(", ")})`
    : "conic-gradient(#e5eaf1 0% 100%)";
  const panel = "relative rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_12px_rgba(20,44,77,0.05)]";

  return (
    <div className="space-y-5 text-slate-800">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{heading}</h1>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-xs text-slate-600">
          <CalendarCheck className="size-4 text-slate-500" />
          {new Intl.DateTimeFormat(ar ? "ar" : "en", { dateStyle: "full" }).format(new Date())}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, href, icon: Icon, color, bg }) => (
          <Link href={href} key={label} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl" style={{ color, backgroundColor: bg }}>
              <Icon className="size-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-500">{label}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
        <section className={panel}>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-bold text-slate-900"><Link href="/projects" className="after:absolute after:inset-0 after:rounded-2xl">{ar ? "تقدم المشاريع" : "Project Progress"}</Link></h2>
            <Link href="/projects" className="relative z-10 text-xs font-semibold text-blue-600 hover:underline">{ar ? "عرض الكل" : "View All"}</Link>
          </div>
          {data.projects.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-xl bg-slate-50 text-center">
              <FolderKanban className="size-9 text-slate-300" />
              <p className="text-sm text-slate-500">{ar ? "لا توجد مشاريع نشطة بعد" : "No active projects yet"}</p>
              <Link href="/projects" className="text-sm font-semibold text-blue-600 hover:underline">{ar ? "إضافة مشروع" : "Add your first project"}</Link>
            </div>
          ) : (
            <div className="space-y-4">
              {data.projects.slice(0, 5).map((project, index) => (
                <Link href={`/projects/${project.id}`} key={project.id} className="relative z-10 block rounded-xl p-2 transition hover:bg-slate-50">
                  <div className="mb-2 flex items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: backgrounds[index % backgrounds.length], color: colors[index % colors.length] }}>
                      <FolderKanban className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{project.name}</p>
                      <p className="text-xs text-slate-400">{project.code}</p>
                    </div>
                    <span className="text-xs font-bold tabular-nums">{project.progress.overall}%</span>
                  </div>
                  <div className="ms-12 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, project.progress.overall))}%`, backgroundColor: colors[index % colors.length] }} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className={panel}>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-bold text-slate-900"><Link href="/beneficiaries" className="after:absolute after:inset-0 after:rounded-2xl">{ar ? "المستفيدون حسب المشروع" : "Beneficiaries by Project"}</Link></h2>
            <Link href="/beneficiaries" className="relative z-10 text-xs font-semibold text-blue-600 hover:underline">{ar ? "عرض الكل" : "View All"}</Link>
          </div>
          <div className="flex flex-col items-center justify-center gap-6 py-4 sm:flex-row">
            <div className="flex size-44 shrink-0 items-center justify-center rounded-full" style={{ background: donut }}>
              <div className="flex size-28 flex-col items-center justify-center rounded-full bg-white">
                <span className="text-3xl font-bold tabular-nums">{data.beneficiaryCount}</span>
                <span className="text-xs text-slate-500">{ar ? "الإجمالي" : "Total"}</span>
              </div>
            </div>
            <div className="w-full min-w-0 space-y-3">
              {segments.length === 0 ? (
                <p className="text-center text-sm text-slate-500">{ar ? "لا توجد بيانات مشاريع بعد" : "No project data yet"}</p>
              ) : segments.map((segment) => (
                <Link href={`/projects/${segment.id}`} key={segment.id} className="relative z-10 flex items-center gap-2 text-xs">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} />
                  <span className="min-w-0 flex-1 truncate">{segment.name}</span>
                  <span className="font-semibold tabular-nums">{segment._count.beneficiaries}</span>
                </Link>
              ))}
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-slate-400">{ar ? "توزيع روابط المستفيدين بالمشاريع النشطة" : "Distribution of beneficiary enrollments across active projects"}</p>
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr_0.9fr]">
        <section className={panel}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold text-slate-900"><Link href="/audit" className="after:absolute after:inset-0 after:rounded-2xl">{ar ? "آخر الأنشطة" : "Recent Activities"}</Link></h2>
            <Link href="/audit" className="relative z-10 text-xs font-semibold text-blue-600 hover:underline">{ar ? "عرض الكل" : "View All"}</Link>
          </div>
          {data.audits.length === 0 ? <p className="py-8 text-sm text-slate-500">{ar ? "لا توجد أنشطة حديثة" : "No recent activity"}</p> : (
            <ul className="space-y-4">
              {data.audits.slice(0, 4).map((entry) => (
                <li key={entry.id}><Link href="/audit" className="relative z-10 flex gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><Activity className="size-4" /></span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{entry.summary}</p>
                    <p className="mt-1 text-xs text-slate-400">{entry.actor} · {formatDateTime(entry.createdAt, locale)}</p>
                  </div>
                </Link></li>
              ))}
            </ul>
          )}
        </section>
        <section className={panel}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold text-slate-900"><Link href="/sessions" className="after:absolute after:inset-0 after:rounded-2xl">{ar ? "الأنشطة القادمة" : "Upcoming Activities"}</Link></h2>
            <Link href="/sessions" className="relative z-10 text-xs font-semibold text-blue-600 hover:underline">{ar ? "عرض الكل" : "View All"}</Link>
          </div>
          {upcoming.length === 0 ? <p className="py-8 text-sm text-slate-500">{ar ? "لا توجد جلسات قادمة" : "No upcoming sessions"}</p> : (
            <ul className="space-y-3">
              {upcoming.map((session) => (
                <li key={session.id}><Link href={`/attendance/${session.id}`} className="relative z-10 flex gap-3 rounded-lg bg-slate-50 p-3">
                  <div className="flex w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                    <span className="text-lg font-bold">{session.scheduledAt.getDate()}</span>
                    <span className="text-[10px]">{new Intl.DateTimeFormat(ar ? "ar" : "en", { month: "short" }).format(session.scheduledAt)}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{session.title}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><Clock3 className="size-3" />{formatDateTime(session.scheduledAt.toISOString(), locale)}</p>
                    {session.location && <p className="truncate text-xs text-slate-400">{session.location}</p>}
                  </div>
                </Link></li>
              ))}
            </ul>
          )}
        </section>
        <section className={panel}>
          <h2 className="mb-4 font-bold text-slate-900">{ar ? "إجراءات سريعة" : "Quick Actions"}</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { href: "/projects", label: ar ? "المشاريع" : "New Project", icon: FolderKanban, color: "#2589f5" },
              { href: "/beneficiaries", label: ar ? "المستفيدون" : "Register Beneficiary", icon: Users, color: "#0bb99e" },
              { href: "/courses", label: ar ? "الدورات" : "Add Course", icon: GraduationCap, color: "#9875e8" },
              { href: "/attendance", label: ar ? "الحضور" : "Take Attendance", icon: ClipboardCheck, color: "#f4a12e" },
            ].map(({ href, label, icon: Icon, color }) => (
              <Link key={href} href={href} className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl p-3 text-center text-white transition hover:brightness-110" style={{ backgroundColor: color }}>
                <Icon className="size-6" />
                <span className="text-xs font-semibold">{label}</span>
              </Link>
            ))}
          </div>
          <Link href="/attendance/records" className="mt-4 flex items-center gap-2 text-xs text-slate-500">
            <ArrowUpRight className="size-4" />
            <span>{ar ? "معدل الحضور" : "Attendance rate"}: {data.attendanceRate}%</span>
          </Link>
          {data.conflictCount > 0 && (
            <Link href="/sync" className="mt-2 flex items-center gap-1 text-xs font-medium text-amber-700">
              <Plus className="size-3" />{data.conflictCount} {ar ? "تعارضات مزامنة" : "sync conflicts"}
            </Link>
          )}
        </section>
      </div>
    </div>
  );
}
