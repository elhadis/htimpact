import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { formatDate, formatDateTime, fullName } from "@/lib/format";
import { getProject, optionLists, progressFromProject } from "@/lib/queries";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/chrome";
import { Forbidden } from "@/components/forbidden";
import { EnumBadge } from "@/components/enum-badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AssignControl } from "@/components/assign-control";
import { ActivityForm } from "@/components/learning-forms";
import { ParticipationBoard } from "@/components/participation-board";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user || !can(session.user.role, "projects", "read")) return <Forbidden />;
  const project = await getProject(id);
  if (!project) notFound();
  const t = await getTranslations();
  const progress = progressFromProject(project);
  const options = await optionLists();
  const canUpdatePeople = can(session.user.role, "beneficiaries", "update");
  const canEditProject = can(session.user.role, "projects", "update");
  const activePeople = project.beneficiaries.filter((link) => link.status !== "withdrawn");

  return (
    <div>
      <PageHeader
        eyebrow={project.code}
        title={project.name}
        description={project.description ?? t("projects.intro")}
        action={
          canEditProject ? (
            <Link className={buttonVariants({ variant: "outline" })} href={`/projects/${project.id}/edit`}>
              {t("common.edit")}
            </Link>
          ) : null
        }
      />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <EnumBadge value={project.type} />
        <EnumBadge value={project.status} />
        <span className="text-sm text-muted-foreground">
          {formatDate(project.startDate, locale)}
          {project.endDate ? ` – ${formatDate(project.endDate, locale)}` : ""}
          {project.location ? ` · ${project.location}` : ""}
        </span>
        <span className="ms-auto text-2xl font-semibold text-teal tabular-nums">{progress.overall}%</span>
      </div>
      <Progress value={progress.overall} />
      <Tabs className="mt-6" defaultValue="overview">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="overview">{t("projects.overview")}</TabsTrigger>
          <TabsTrigger value="people">{t("projects.people")}</TabsTrigger>
          <TabsTrigger value="work">
            {project.type === "EDUCATIONAL" ? t("projects.learning") : t("projects.activities")}
          </TabsTrigger>
          <TabsTrigger value="team">{t("projects.team")}</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <div className="grid gap-3">
            {progress.metrics.map((metric) => (
              <div key={metric.metricKey} className="rounded-xl border bg-card p-4">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium">{metric.label}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {metric.actual} / {metric.target} {metric.unit}
                  </span>
                </div>
                <Progress className="mt-3" value={metric.percent} />
              </div>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="people" className="space-y-4">
          {canUpdatePeople ? (
            <AssignControl projectId={project.id} projectName={project.name} people={options.people} />
          ) : null}
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-secondary/70 text-xs tracking-wide text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-3 text-start">{t("beneficiaries.code")}</th>
                  <th className="px-4 py-3 text-start">{t("beneficiaries.name")}</th>
                  <th className="px-4 py-3 text-start">{t("projects.status")}</th>
                </tr>
              </thead>
              <tbody>
                {project.beneficiaries.map((link) => (
                  <tr key={link.id} className="border-t">
                    <td className="px-4 py-3">{link.beneficiary.code}</td>
                    <td className="px-4 py-3">
                      <Link className="font-medium text-teal" href={`/beneficiaries/${link.beneficiary.id}`}>
                        {fullName(link.beneficiary)}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <EnumBadge value={link.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-muted-foreground">
            {activePeople.length} {t("projects.people")}
          </p>
        </TabsContent>
        <TabsContent value="work" className="space-y-6">
          {project.type === "EDUCATIONAL" ? (
            project.courses.map((course) => (
              <section key={course.id} className="rounded-xl border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-semibold">{course.name}</h2>
                    <p className="text-xs text-muted-foreground">{course.code}</p>
                  </div>
                  <Link className="text-sm font-medium text-teal" href={`/courses/${course.id}`}>
                    {t("common.open")}
                  </Link>
                </div>
                <ul className="mt-3 space-y-2">
                  {course.cohorts.map((cohort) => (
                    <li key={cohort.id} className="rounded-lg bg-background px-3 py-2">
                      <Link className="font-medium" href={`/cohorts/${cohort.id}`}>
                        {cohort.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {cohort.enrollments.length} · {cohort.sessions.length}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          ) : (
            <div className="space-y-6">
              {can(session.user.role, "activities", "create") ? <ActivityForm projectId={project.id} /> : null}
              {project.activities.map((activity) => (
                <section key={activity.id} className="rounded-xl border bg-card p-4">
                  <h2 className="font-semibold">{activity.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    {formatDateTime(activity.scheduledAt, locale)}
                    {activity.location ? ` · ${activity.location}` : ""}
                  </p>
                  <div className="mt-4">
                    <ParticipationBoard
                      activityId={activity.id}
                      canEdit={can(session.user.role, "activities", "update")}
                      rows={activePeople.map((link) => ({
                        beneficiaryId: link.beneficiary.id,
                        name: fullName(link.beneficiary),
                        participated:
                          activity.logs.find((log) => log.beneficiaryId === link.beneficiary.id)?.participated ?? false,
                      }))}
                    />
                  </div>
                </section>
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="team">
          <ul className="space-y-2">
            {project.staff.map((member) => (
              <li key={member.id} className="rounded-xl border bg-card px-4 py-3">
                <p className="font-medium">{member.user.name}</p>
                <p className="text-sm text-muted-foreground">
                  {member.user.title || member.user.role.key} · {member.user.email}
                </p>
              </li>
            ))}
          </ul>
        </TabsContent>
      </Tabs>
    </div>
  );
}
