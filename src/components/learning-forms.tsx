"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { activitySchema, cohortSchema, courseSchema, sessionSchema } from "@/lib/validators";
import { createActivity, createCohort, createCourse, createSession, enrollBeneficiary } from "@/server/mutations";
import { Button } from "@/components/ui/button";
import { offlineDb, queueModeEnabled } from "@/lib/offline/db";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Field } from "@/components/chrome";
import type { z } from "zod";

function useSave() {
  const t = useTranslations();
  const router = useRouter();
  return {
    t,
    router,
    done(result: { ok: boolean; error?: string; id?: string }, href: string) {
      if (!result.ok) {
        toast.error(t(`errors.${result.error ?? "invalid"}`));
        return;
      }
      toast.success(t("common.saved"));
      router.push(href);
      router.refresh();
    },
  };
}

export function CourseForm({
  projects,
}: {
  projects: { id: string; name: string; code: string }[];
}) {
  const { t, done } = useSave();
  const form = useForm<z.infer<typeof courseSchema>>({
    resolver: zodResolver(courseSchema) as Resolver<z.infer<typeof courseSchema>>,
    defaultValues: { projectId: projects[0]?.id ?? "", code: "", name: "", description: "", hours: "" },
  });
  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={form.handleSubmit(async (values) => {
        const queue = async () => {
          try {
            await offlineDb.courseQueue.put({ clientMutationId: crypto.randomUUID(), values });
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
          const result = await createCourse(values);
          done(result, `/courses/${result.ok ? result.id : ""}`);
        } catch {
          await queue();
        }
      })}
    >
      <Field label={t("learning.project")} className="sm:col-span-2">
        <NativeSelect {...form.register("projectId")}>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.code} · {project.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label={t("learning.courseCode")}>
        <Input {...form.register("code")} />
      </Field>
      <Field label={t("learning.courseName")}>
        <Input {...form.register("name")} />
      </Field>
      <Field label={t("learning.hours")}>
        <Input type="number" min={1} {...form.register("hours")} />
      </Field>
      <Field label={t("projects.description")} className="sm:col-span-2">
        <Textarea {...form.register("description")} />
      </Field>
      <Button type="submit" disabled={form.formState.isSubmitting || projects.length === 0}>
        {t("common.save")}
      </Button>
    </form>
  );
}

export function CohortForm({ courses }: { courses: { id: string; name: string; projectName: string }[] }) {
  const { t, done } = useSave();
  const form = useForm<z.infer<typeof cohortSchema>>({
    resolver: zodResolver(cohortSchema) as Resolver<z.infer<typeof cohortSchema>>,
    defaultValues: { courseId: courses[0]?.id ?? "", name: "", startDate: "", endDate: "", capacity: "", location: "" },
  });
  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={form.handleSubmit(async (values) => {
        const result = await createCohort(values);
        done(result, `/cohorts/${result.ok ? result.id : ""}`);
      })}
    >
      <Field label={t("learning.course")} className="sm:col-span-2">
        <NativeSelect {...form.register("courseId")}>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.projectName} · {course.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label={t("learning.cohortName")}>
        <Input {...form.register("name")} />
      </Field>
      <Field label={t("learning.capacity")}>
        <Input type="number" min={1} {...form.register("capacity")} />
      </Field>
      <Field label={t("projects.start")}>
        <Input type="date" {...form.register("startDate")} />
      </Field>
      <Field label={t("projects.end")}>
        <Input type="date" {...form.register("endDate")} />
      </Field>
      <Field label={t("projects.location")} className="sm:col-span-2">
        <Input {...form.register("location")} />
      </Field>
      <Button type="submit" disabled={form.formState.isSubmitting || courses.length === 0}>
        {t("common.save")}
      </Button>
    </form>
  );
}

export function SessionForm({
  cohorts,
  staff,
}: {
  cohorts: { id: string; name: string; courseName: string }[];
  staff: { id: string; name: string }[];
}) {
  const { t, done } = useSave();
  const form = useForm<z.infer<typeof sessionSchema>>({
    resolver: zodResolver(sessionSchema) as Resolver<z.infer<typeof sessionSchema>>,
    defaultValues: {
      cohortId: cohorts[0]?.id ?? "",
      title: "",
      scheduledAt: "",
      durationMin: 60,
      location: "",
      facilitatorId: "",
      notes: "",
    },
  });
  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={form.handleSubmit(async (values) => {
        const result = await createSession(values);
        done(result, `/attendance/${result.ok ? result.id : ""}`);
      })}
    >
      <Field label={t("learning.cohort")} className="sm:col-span-2">
        <NativeSelect {...form.register("cohortId")}>
          {cohorts.map((cohort) => (
            <option key={cohort.id} value={cohort.id}>
              {cohort.courseName} · {cohort.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label={t("learning.sessionTitle")}>
        <Input {...form.register("title")} />
      </Field>
      <Field label={t("learning.when")}>
        <Input type="datetime-local" {...form.register("scheduledAt")} />
      </Field>
      <Field label={t("learning.duration")}>
        <Input type="number" min={15} {...form.register("durationMin")} />
      </Field>
      <Field label={t("projects.location")}>
        <Input {...form.register("location")} />
      </Field>
      <Field label={t("learning.facilitator")} className="sm:col-span-2">
        <NativeSelect {...form.register("facilitatorId")}>
          <option value="">{t("common.optional")}</option>
          {staff.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label={t("projects.description")} className="sm:col-span-2">
        <Textarea {...form.register("notes")} />
      </Field>
      <Button type="submit" disabled={form.formState.isSubmitting || cohorts.length === 0}>
        {t("common.save")}
      </Button>
    </form>
  );
}

export function ActivityForm({ projectId }: { projectId: string }) {
  const { t, done } = useSave();
  const form = useForm<z.infer<typeof activitySchema>>({
    resolver: zodResolver(activitySchema) as Resolver<z.infer<typeof activitySchema>>,
    defaultValues: { projectId, name: "", description: "", scheduledAt: "", location: "" },
  });
  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={form.handleSubmit(async (values) => {
        const result = await createActivity(values);
        done(result, `/projects/${projectId}`);
      })}
    >
      <Field label={t("learning.activityName")}>
        <Input {...form.register("name")} />
      </Field>
      <Field label={t("learning.when")}>
        <Input type="datetime-local" {...form.register("scheduledAt")} />
      </Field>
      <Field label={t("projects.location")} className="sm:col-span-2">
        <Input {...form.register("location")} />
      </Field>
      <Field label={t("projects.description")} className="sm:col-span-2">
        <Textarea {...form.register("description")} />
      </Field>
      <Button type="submit" disabled={form.formState.isSubmitting}>
        {t("common.save")}
      </Button>
    </form>
  );
}

export function EnrollForm({
  cohortId,
  people,
}: {
  cohortId: string;
  people: { id: string; name: string; code: string }[];
}) {
  const t = useTranslations();
  const router = useRouter();
  const [beneficiaryId, setBeneficiaryId] = useState(people[0]?.id ?? "");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    const pendingEnrollment = { clientMutationId: crypto.randomUUID(), cohortId, beneficiaryId };
    if (queueModeEnabled()) {
      try {
        await offlineDb.enrollmentQueue.put(pendingEnrollment);
        toast.success(t("common.saved"));
      } catch {
        toast.error(t("errors.syncFailed"));
      } finally {
        setPending(false);
      }
      return;
    }
    let result: Awaited<ReturnType<typeof enrollBeneficiary>>;
    try {
      result = await enrollBeneficiary({ cohortId, beneficiaryId });
    } catch {
      try {
        await offlineDb.enrollmentQueue.put(pendingEnrollment);
        toast.success(t("common.saved"));
      } catch {
        toast.error(t("errors.syncFailed"));
      } finally {
        setPending(false);
      }
      return;
    }
    setPending(false);
    if (!result.ok) {
      toast.error(t(`errors.${result.error}`));
      return;
    }
    toast.success(t("learning.enrolled"));
    router.refresh();
  }

  return (
    <form className="flex flex-col gap-3 sm:flex-row" onSubmit={onSubmit}>
      <NativeSelect value={beneficiaryId} onChange={(event) => setBeneficiaryId(event.target.value)} className="sm:max-w-sm">
        {people.map((person) => (
          <option key={person.id} value={person.id}>
            {person.code} · {person.name}
          </option>
        ))}
      </NativeSelect>
      <Button type="submit" disabled={pending || people.length === 0}>
        {t("learning.enroll")}
      </Button>
    </form>
  );
}
