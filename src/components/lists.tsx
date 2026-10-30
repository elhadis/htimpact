"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { DataTable } from "@/components/data-table";
import { EnumBadge } from "@/components/enum-badge";
import { formatDate, formatDateTime } from "@/lib/format";

function useLabels() {
  const t = useTranslations("common");
  return {
    search: t("search"),
    empty: t("empty"),
    previous: t("previous"),
    next: t("next"),
    swipe: t("swipe"),
  };
}

export function ProjectsTable({
  rows,
}: {
  rows: {
    id: string;
    code: string;
    name: string;
    type: string;
    status: string;
    location: string | null;
    startDate: string;
    progress: number;
    beneficiaryCount: number;
  }[];
}) {
  const t = useTranslations();
  const locale = useLocale();
  const columns: ColumnDef<(typeof rows)[number]>[] = [
    { accessorKey: "code", header: t("projects.code") },
    { accessorKey: "name", header: t("projects.name") },
    { accessorKey: "type", header: t("projects.type"), cell: ({ row }) => <EnumBadge value={row.original.type} /> },
    { accessorKey: "status", header: t("projects.status"), cell: ({ row }) => <EnumBadge value={row.original.status} /> },
    { accessorKey: "location", header: t("projects.location"), cell: ({ getValue }) => getValue<string>() || "—" },
    {
      accessorKey: "startDate",
      header: t("projects.start"),
      cell: ({ row }) => formatDate(row.original.startDate, locale),
    },
    { accessorKey: "beneficiaryCount", header: t("projects.people") },
    { accessorKey: "progress", header: t("projects.progress"), cell: ({ row }) => `${row.original.progress}%` },
    {
      id: "open",
      header: "",
      enableGlobalFilter: false,
      cell: ({ row }) => (
        <Link className="font-medium text-teal" href={`/projects/${row.original.id}`}>
          {t("common.open")}
        </Link>
      ),
    },
  ];
  return <DataTable columns={columns} data={rows} labels={useLabels()} />;
}

export function BeneficiariesTable({
  rows,
}: {
  rows: { id: string; code: string; name: string; gender: string; community: string | null; projects: string; projectCount: number }[];
}) {
  const t = useTranslations();
  const columns: ColumnDef<(typeof rows)[number]>[] = [
    { accessorKey: "code", header: t("beneficiaries.code") },
    { accessorKey: "name", header: t("beneficiaries.name") },
    { accessorKey: "gender", header: t("beneficiaries.gender"), cell: ({ row }) => <EnumBadge value={row.original.gender} /> },
    { accessorKey: "community", header: t("beneficiaries.community"), cell: ({ getValue }) => getValue<string>() || "—" },
    { accessorKey: "projects", header: t("beneficiaries.projects") },
    { accessorKey: "projectCount", header: t("beneficiaries.count") },
    {
      id: "open",
      header: "",
      enableGlobalFilter: false,
      cell: ({ row }) => (
        <Link className="font-medium text-teal" href={`/beneficiaries/${row.original.id}`}>
          {t("common.open")}
        </Link>
      ),
    },
  ];
  return <DataTable columns={columns} data={rows} labels={useLabels()} />;
}

export function SessionsTable({
  rows,
}: {
  rows: {
    id: string;
    title: string;
    scheduledAt: string;
    project: string;
    course: string;
    cohort: string;
    enrolled: number;
    marked: number;
  }[];
}) {
  const t = useTranslations();
  const locale = useLocale();
  const columns: ColumnDef<(typeof rows)[number]>[] = [
    { accessorKey: "title", header: t("learning.sessionTitle") },
    { accessorKey: "scheduledAt", header: t("learning.when"), cell: ({ row }) => formatDateTime(row.original.scheduledAt, locale) },
    { accessorKey: "project", header: t("projects.title") },
    { accessorKey: "cohort", header: t("learning.cohort") },
    { accessorKey: "enrolled", header: t("attendance.enrolled") },
    { accessorKey: "marked", header: t("attendance.marked") },
    {
      id: "open",
      header: "",
      enableGlobalFilter: false,
      cell: ({ row }) => (
        <Link className="font-medium text-teal" href={`/attendance/${row.original.id}`}>
          {t("attendance.take")}
        </Link>
      ),
    },
  ];
  return <DataTable columns={columns} data={rows} labels={useLabels()} />;
}

export function StaffTable({
  rows,
}: {
  rows: { id: string; name: string; email: string; role: string; title: string | null; active: boolean; projects: string }[];
}) {
  const t = useTranslations();
  const columns: ColumnDef<(typeof rows)[number]>[] = [
    { accessorKey: "name", header: t("staff.name") },
    { accessorKey: "email", header: t("staff.email") },
    { accessorKey: "role", header: t("staff.role"), cell: ({ row }) => t(`roles.${row.original.role}`) },
    { accessorKey: "title", header: t("staff.title"), cell: ({ getValue }) => getValue<string>() || "—" },
    { accessorKey: "projects", header: t("staff.projects") },
    {
      accessorKey: "active",
      header: t("projects.status"),
      cell: ({ row }) => <EnumBadge value={row.original.active ? "active" : "withdrawn"} />,
    },
    {
      id: "open",
      header: "",
      enableGlobalFilter: false,
      cell: ({ row }) => (
        <Link className="font-medium text-teal" href={`/staff/${row.original.id}/edit`}>
          {t("common.edit")}
        </Link>
      ),
    },
  ];
  return <DataTable columns={columns} data={rows} labels={useLabels()} />;
}

export function AuditTable({
  rows,
}: {
  rows: { id: string; createdAt: string; actor: string; action: string; summary: string; entityType: string }[];
}) {
  const t = useTranslations();
  const locale = useLocale();
  const columns: ColumnDef<(typeof rows)[number]>[] = [
    { accessorKey: "createdAt", header: t("audit.when"), cell: ({ row }) => formatDateTime(row.original.createdAt, locale) },
    { accessorKey: "actor", header: t("audit.actor") },
    { accessorKey: "action", header: t("audit.action"), cell: ({ row }) => <EnumBadge value={row.original.action} /> },
    { accessorKey: "entityType", header: t("projects.type") },
    { accessorKey: "summary", header: t("audit.summary") },
  ];
  return <DataTable columns={columns} data={rows} labels={useLabels()} />;
}
