import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { guard } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { PageHeader } from "@/components/chrome";
import { Forbidden } from "@/components/forbidden";
import { CenterForm } from "@/components/center-forms";
import { formatDateTime } from "@/lib/format";
export default async function CenterDetail({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params; setRequestLocale(locale);
  const access = await guard("centers", "read"); if (!access.ok) return <Forbidden />;
  const center = await prisma.center.findUnique({ where: { id }, include: { projects: { include: { project: true } }, staff: { where: { active: true }, select: { id: true, name: true, role: true } } } });
  if (!center) notFound();
  const t = await getTranslations();
  const [people, sessions, activities, attendance, projects, managers] = await Promise.all([
    prisma.beneficiary.findMany({ where: { centerId: id }, orderBy: { lastName: "asc" } }),
    prisma.session.findMany({ where: { cohort: { centerId: id } }, include: { cohort: { select: { name: true } } }, orderBy: { scheduledAt: "desc" } }),
    prisma.activity.findMany({ where: { centerId: id }, orderBy: { name: "asc" } }),
    prisma.attendanceRecord.groupBy({ by: ["status"], where: { session: { cohort: { centerId: id } } }, _count: true }),
    access.session.user.role === "ADMIN" ? prisma.project.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }) : [],
    access.session.user.role === "ADMIN" ? prisma.user.findMany({ where: { active: true, role: { key: "CENTER_MANAGER" }, OR: [{ centerId: null }, { centerId: id }] }, select: { id: true, name: true } }) : [],
  ]);
  const cards = [
    { href: "#people", label: t("nav.beneficiaries"), value: people.length },
    { href: "#projects", label: t("nav.projects"), value: center.projects.length },
    { href: "#sessions", label: t("nav.sessions"), value: sessions.length },
    { href: "#attendance", label: t("nav.attendance"), value: attendance.reduce((sum, row) => sum + row._count, 0) },
  ];
  const panel = "space-y-3 rounded-2xl border bg-card p-5";
  return <div className="space-y-5"><PageHeader title={center.name} description={`${center.code} · ${center.location ?? ""}`} />
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map((card) => <a key={card.href} href={card.href} className={panel}><p className="text-sm text-muted-foreground">{card.label}</p><p className="text-2xl font-bold">{card.value}</p></a>)}</div>
    <section id="people" className={panel}><h2 className="font-semibold">{t("nav.beneficiaries")}</h2>{people.map((person) => <Link className="block rounded-lg border p-3 hover:bg-secondary" href={`/beneficiaries/${person.id}`} key={person.id}>{person.code} · {person.firstName} {person.lastName}</Link>)}</section>
    <section id="projects" className={panel}><h2 className="font-semibold">{t("nav.projects")}</h2>{center.projects.map(({ project }) => <Link className="block rounded-lg border p-3 hover:bg-secondary" href={`/projects/${project.id}`} key={project.id}>{project.code} · {project.name}</Link>)}</section>
    <section id="sessions" className={panel}><h2 className="font-semibold">{t("nav.sessions")}</h2>{sessions.map((session) => <Link className="block rounded-lg border p-3 hover:bg-secondary" href={`/attendance/${session.id}`} key={session.id}>{session.title} · {session.cohort.name} · {formatDateTime(session.scheduledAt.toISOString(), locale)}</Link>)}</section>
    <section id="attendance" className={panel}><h2 className="font-semibold">{t("nav.attendance")}</h2><div className="flex flex-wrap gap-3">{attendance.map((row) => <Link className="rounded-lg border p-3" href={`/attendance/records?centerId=${id}&status=${row.status}`} key={row.status}>{t(`enums.${row.status}`)}: {row._count}</Link>)}</div></section>
    <section className={panel}><h2 className="font-semibold">{t("nav.activities")}</h2>{activities.map((activity) => <Link key={activity.id} className="block rounded-lg border p-3" href={`/projects/${activity.projectId}`}>{activity.name}</Link>)}</section>
    {access.session.user.role === "ADMIN" && <details className={panel}><summary className="cursor-pointer font-semibold">{t("common.edit")}</summary><CenterForm projects={projects} managers={managers} defaults={{ id: center.id, code: center.code, name: center.name, location: center.location ?? "", active: center.active, projectIds: center.projects.map((row) => row.projectId), managerIds: center.staff.filter((row) => row.role.key === "CENTER_MANAGER").map((row) => row.id) }} /></details>}
  </div>;
}
