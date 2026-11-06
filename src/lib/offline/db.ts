"use client";

import Dexie, { type Table } from "dexie";
import type { centerSchema, transferSchema } from "@/lib/validators";
import type { ProjectInput, BeneficiaryInput } from "@/lib/validators";
import type { z } from "zod";
import { cohortSchema, sessionSchema, activitySchema } from "@/lib/validators";

export type QueuedAttendance = {
  clientMutationId: string;
  sessionId: string;
  beneficiaryId: string;
  beneficiaryName: string;
  status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
  note: string | null;
  recordedAt: string;
  baseUpdatedAt: string | null;
};

export type QueuedAssignment = {
  clientMutationId: string;
  projectId: string;
  beneficiaryId: string;
  beneficiaryName: string;
  projectName: string;
  op: "ASSIGN" | "WITHDRAW";
  note: string | null;
  baseUpdatedAt: string | null;
  baseNotes: string | null;
};

export type QueuedParticipation = {
  clientMutationId: string;
  activityId: string;
  rows: { beneficiaryId: string; participated: boolean }[];
};

export type QueuedCohort = { clientMutationId: string; values: z.infer<typeof cohortSchema> };
export type QueuedSession = { clientMutationId: string; values: z.infer<typeof sessionSchema> };
export type QueuedActivity = { clientMutationId: string; values: z.infer<typeof activitySchema> };

export type QueuedBeneficiary = { clientMutationId: string; values: BeneficiaryInput };

export type QueuedProject = { clientMutationId: string; values: ProjectInput };

export type QueuedCourse = {
  clientMutationId: string;
  values: { projectId: string; code: string; name: string; description?: string; hours?: string | number };
};

export type QueuedEnrollment = {
  clientMutationId: string;
  cohortId: string;
  beneficiaryId: string;
};

export type CachedRoster = {
  sessionId: string;
  updatedAt: string;
  payload: string;
};

export type QueuedCenter = { clientMutationId: string; values: z.infer<typeof centerSchema> };
export type QueuedTransfer = { clientMutationId: string; values: z.infer<typeof transferSchema> };

class ImpactDB extends Dexie {
  centerQueue!: Table<QueuedCenter, string>;
  transferQueue!: Table<QueuedTransfer, string>;
  attendanceQueue!: Table<QueuedAttendance, string>;
  assignmentQueue!: Table<QueuedAssignment, string>;
  rosters!: Table<CachedRoster, string>;
  participationQueue!: Table<QueuedParticipation, string>;
  enrollmentQueue!: Table<QueuedEnrollment, string>;
  courseQueue!: Table<QueuedCourse, string>;
  projectQueue!: Table<QueuedProject, string>;
  beneficiaryQueue!: Table<QueuedBeneficiary, string>;
  cohortQueue!: Table<QueuedCohort, string>;
  sessionQueue!: Table<QueuedSession, string>;
  activityQueue!: Table<QueuedActivity, string>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      attendanceQueue: "clientMutationId, sessionId, beneficiaryId",
      assignmentQueue: "clientMutationId, projectId, beneficiaryId",
      rosters: "sessionId",
    });
    this.version(2).stores({
      attendanceQueue: "clientMutationId, sessionId, beneficiaryId",
      assignmentQueue: "clientMutationId, projectId, beneficiaryId",
      rosters: "sessionId",
      participationQueue: "clientMutationId, activityId",
    });
    this.version(3).stores({
      attendanceQueue: "clientMutationId, sessionId, beneficiaryId",
      assignmentQueue: "clientMutationId, projectId, beneficiaryId",
      rosters: "sessionId",
      participationQueue: "clientMutationId, activityId",
      enrollmentQueue: "clientMutationId, cohortId, beneficiaryId",
    });
    this.version(4).stores({
      attendanceQueue: "clientMutationId, sessionId, beneficiaryId",
      assignmentQueue: "clientMutationId, projectId, beneficiaryId",
      rosters: "sessionId",
      participationQueue: "clientMutationId, activityId",
      enrollmentQueue: "clientMutationId, cohortId, beneficiaryId",
      courseQueue: "clientMutationId, values.projectId",
    });
    this.version(5).stores({
      attendanceQueue: "clientMutationId, sessionId, beneficiaryId",
      assignmentQueue: "clientMutationId, projectId, beneficiaryId",
      rosters: "sessionId",
      participationQueue: "clientMutationId, activityId",
      enrollmentQueue: "clientMutationId, cohortId, beneficiaryId",
      courseQueue: "clientMutationId, values.projectId",
      projectQueue: "clientMutationId",
    });
    this.version(6).stores({
      attendanceQueue: "clientMutationId, sessionId, beneficiaryId",
      assignmentQueue: "clientMutationId, projectId, beneficiaryId",
      rosters: "sessionId",
      participationQueue: "clientMutationId, activityId",
      enrollmentQueue: "clientMutationId, cohortId, beneficiaryId",
      courseQueue: "clientMutationId, values.projectId",
      projectQueue: "clientMutationId",
      beneficiaryQueue: "clientMutationId",
    });
    this.version(8).stores({
      centerQueue: "clientMutationId",
      transferQueue: "clientMutationId",
      attendanceQueue: "clientMutationId, sessionId, beneficiaryId",
      assignmentQueue: "clientMutationId, projectId, beneficiaryId",
      rosters: "sessionId",
      participationQueue: "clientMutationId, activityId",
      enrollmentQueue: "clientMutationId, cohortId, beneficiaryId",
      courseQueue: "clientMutationId, values.projectId",
      projectQueue: "clientMutationId",
      beneficiaryQueue: "clientMutationId",
      cohortQueue: "clientMutationId",
      sessionQueue: "clientMutationId",
      activityQueue: "clientMutationId",
    });
  }
}

let activeScope = "unassigned";
const databases = new Map<string, ImpactDB>();
export function setOfflineScope(scope: string) { activeScope = scope; }
function database() {
  let db = databases.get(activeScope);
  if (!db) { db = new ImpactDB(`ht-impact-manager:${activeScope}`); databases.set(activeScope, db); }
  return db;
}
// Legacy shared queues are intentionally not reassigned to an arbitrary account.
export const offlineDb = new Proxy({} as ImpactDB, {
  get(_target, key) {
    const db = database();
    const value = Reflect.get(db, key, db);
    return typeof value === "function" ? value.bind(db) : value;
  },
});

export function queueModeEnabled() {
  return typeof window !== "undefined" && (localStorage.getItem("ht-queue-mode") === "1" || !navigator.onLine);
}
