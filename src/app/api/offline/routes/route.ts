import { NextResponse } from "next/server";
import { currentActor } from "@/lib/center-scope";
import { prisma } from "@/lib/prisma";
import { can, type Resource } from "@/lib/rbac";

export async function GET() {
  const actor = await currentActor();
  const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
  if (!actor?.active) return NextResponse.json({ error: "auth" }, { status: 401, headers });
  const role = actor.role.key;
  const paths = new Set<string>(["/dashboard"]);
  const resources: Resource[] = ["quality", "centers", "transfers", "projects", "beneficiaries", "courses", "cohorts", "sessions", "attendance", "activities", "staff", "reports", "audit", "sync"];
  for (const resource of resources) if (can(role, resource, "read")) paths.add(`/${resource}`);
  for (const resource of ["centers", "projects", "beneficiaries", "courses", "cohorts", "sessions", "staff"] as const) {
    if (can(role, resource, "create")) paths.add(`/${resource}/new`);
  }
  // Use the same scoped Prisma client as the screens, including IDs hidden by
  // table pagination. Never infer another center's records from global counts.
  const [projects, people, courses, cohorts, sessions, staff, centers] = await Promise.all([
    can(role, "projects", "read") ? prisma.project.findMany({ select: { id: true } }) : [],
    can(role, "beneficiaries", "read") ? prisma.beneficiary.findMany({ select: { id: true } }) : [],
    can(role, "courses", "read") ? prisma.course.findMany({ select: { id: true } }) : [],
    can(role, "cohorts", "read") ? prisma.cohort.findMany({ select: { id: true } }) : [],
    can(role, "attendance", "read") ? prisma.session.findMany({ select: { id: true } }) : [],
    can(role, "staff", "update") ? prisma.user.findMany({ select: { id: true } }) : [],
    can(role, "centers", "read") ? prisma.center.findMany({ select: { id: true } }) : [],
  ]);
  for (const project of projects) {
    paths.add(`/projects/${project.id}`);
    if (can(role, "projects", "update")) paths.add(`/projects/${project.id}/edit`);
    if (can(role, "reports", "read")) paths.add(`/reports?projectId=${project.id}`);
  }
  for (const person of people) {
    paths.add(`/beneficiaries/${person.id}`);
    if (can(role, "beneficiaries", "update")) paths.add(`/beneficiaries/${person.id}/edit`);
  }
  for (const course of courses) { paths.add(`/courses/${course.id}`); if (can(role, "courses", "update")) paths.add(`/courses/${course.id}/edit`); }
  for (const cohort of cohorts) paths.add(`/cohorts/${cohort.id}`);
  for (const session of sessions) paths.add(`/attendance/${session.id}`);
  for (const person of staff) paths.add(`/staff/${person.id}/edit`);
  for (const center of centers) {
    paths.add(`/centers/${center.id}`);
    if (can(role, "attendance", "read")) {
      paths.add(`/attendance?centerId=${center.id}`);
      for (const status of ["PRESENT", "ABSENT", "LATE", "EXCUSED"]) paths.add(`/attendance/records?centerId=${center.id}&status=${status}`);
    }
  }
  if (can(role, "projects", "read")) paths.add("/projects?status=active");
  if (can(role, "courses", "read")) paths.add("/courses?view=all");
  if (can(role, "staff", "read")) paths.add("/staff?active=1");
  if (can(role, "transfers", "read")) paths.add("/transfers?status=PENDING");
  if (can(role, "attendance", "read")) {
    paths.add("/attendance/records");
    paths.add("/attendance/records?status=positive");
    paths.add("/attendance/records?status=ABSENT");
  }
  return NextResponse.json({
    scope: `${actor.id}:${actor.centerId ?? "global"}:${role}`,
    paths: [...paths],
  }, { headers });
}
