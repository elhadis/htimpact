"use client";

import Dexie, { type Table } from "dexie";

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

export type CachedRoster = {
  sessionId: string;
  updatedAt: string;
  payload: string;
};

class ImpactDB extends Dexie {
  attendanceQueue!: Table<QueuedAttendance, string>;
  assignmentQueue!: Table<QueuedAssignment, string>;
  rosters!: Table<CachedRoster, string>;

  constructor() {
    super("ht-impact-manager");
    this.version(1).stores({
      attendanceQueue: "clientMutationId, sessionId, beneficiaryId",
      assignmentQueue: "clientMutationId, projectId, beneficiaryId",
      rosters: "sessionId",
    });
  }
}

export const offlineDb = new ImpactDB();

export function queueModeEnabled() {
  return typeof window !== "undefined" && (localStorage.getItem("ht-queue-mode") === "1" || !navigator.onLine);
}
