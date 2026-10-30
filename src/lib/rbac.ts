export const ROLES = [
  "ADMIN",
  "PROJECT_MANAGER",
  "COORDINATOR",
  "FACILITATOR",
  "VIEWER",
] as const;

export type AppRole = (typeof ROLES)[number];

export const RESOURCES = [
  "projects",
  "beneficiaries",
  "courses",
  "cohorts",
  "sessions",
  "attendance",
  "activities",
  "staff",
  "reports",
  "audit",
  "sync",
] as const;

export type Resource = (typeof RESOURCES)[number];

export const ACTIONS = ["create", "read", "update", "delete", "export"] as const;
export type PermissionAction = (typeof ACTIONS)[number];

const ALL = RESOURCES.flatMap((resource) =>
  ACTIONS.map((action) => `${resource}:${action}`),
);

const ROLE_MATRIX: Record<AppRole, string[]> = {
  ADMIN: ["*"],
  PROJECT_MANAGER: [
    "projects:create",
    "projects:read",
    "projects:update",
    "beneficiaries:create",
    "beneficiaries:read",
    "beneficiaries:update",
    "courses:create",
    "courses:read",
    "courses:update",
    "courses:delete",
    "cohorts:create",
    "cohorts:read",
    "cohorts:update",
    "cohorts:delete",
    "sessions:create",
    "sessions:read",
    "sessions:update",
    "sessions:delete",
    "attendance:create",
    "attendance:read",
    "attendance:update",
    "activities:create",
    "activities:read",
    "activities:update",
    "activities:delete",
    "staff:create",
    "staff:read",
    "staff:update",
    "reports:read",
    "reports:export",
    "audit:read",
    "sync:read",
    "sync:update",
  ],
  COORDINATOR: [
    "projects:read",
    "beneficiaries:create",
    "beneficiaries:read",
    "beneficiaries:update",
    "courses:create",
    "courses:read",
    "courses:update",
    "cohorts:create",
    "cohorts:read",
    "cohorts:update",
    "sessions:create",
    "sessions:read",
    "sessions:update",
    "attendance:create",
    "attendance:read",
    "attendance:update",
    "activities:create",
    "activities:read",
    "activities:update",
    "staff:read",
    "reports:read",
    "reports:export",
    "sync:read",
    "sync:update",
  ],
  FACILITATOR: [
    "projects:read",
    "beneficiaries:read",
    "courses:read",
    "cohorts:read",
    "sessions:read",
    "attendance:create",
    "attendance:read",
    "attendance:update",
    "activities:read",
    "activities:update",
    "reports:read",
    "sync:read",
    "sync:update",
  ],
  VIEWER: [
    "projects:read",
    "beneficiaries:read",
    "courses:read",
    "cohorts:read",
    "sessions:read",
    "attendance:read",
    "activities:read",
    "reports:read",
    "reports:export",
    "audit:read",
    "sync:read",
  ],
};

export const ROLE_DETAILS: Record<AppRole, { name: string; description: string }> = {
  ADMIN: {
    name: "Administrator",
    description: "Full access to programs, people, staff, and records.",
  },
  PROJECT_MANAGER: {
    name: "Project manager",
    description: "Runs projects, teams, and reporting. Cannot delete staff accounts.",
  },
  COORDINATOR: {
    name: "Coordinator",
    description: "Registers beneficiaries, enrolls classes, and records participation.",
  },
  FACILITATOR: {
    name: "Facilitator",
    description: "Takes attendance and logs participation on assigned projects.",
  },
  VIEWER: {
    name: "Viewer",
    description: "Reads records and exports reports.",
  },
};

export function isAppRole(value: string): value is AppRole {
  return (ROLES as readonly string[]).includes(value);
}

export function can(role: string, resource: Resource, action: PermissionAction) {
  if (!isAppRole(role)) return false;
  const grants = ROLE_MATRIX[role];
  if (grants.includes("*") || grants.includes(`${resource}:${action}`)) return true;
  if (role === "ADMIN") return ALL.includes(`${resource}:${action}`);
  return false;
}

export function grantsFor(role: string) {
  if (!isAppRole(role)) return [];
  if (ROLE_MATRIX[role].includes("*")) return ALL;
  return ROLE_MATRIX[role];
}
