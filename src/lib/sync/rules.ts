/**
 * Conflict rules for offline attendance and project assignment.
 *
 * Attendance identity is session + beneficiary.
 * - Missing session: keep the field mark as a conflict. Do not invent a session.
 * - No server row: insert the field mark.
 * - Identical status and note: drop the queued mark.
 * - Server unchanged since baseUpdatedAt: field mark wins.
 * - Server changed, and only the field mark falls inside the session window
 *   (15 minutes before the start through 2 hours after the end): field mark wins.
 * - Server changed, and the field mark is outside that window: server wins.
 * - Server changed, and both marks fall inside the window but disagree: conflict.
 *   The server value stays until a person chooses.
 *
 * Assignment identity is project + beneficiary. The person record is never copied.
 * - Assign when no link exists: create the link.
 * - Assign when the link is already active: no change.
 * - Assign when the server withdrew the link after this device copied it: conflict.
 * - Withdraw when the server notes changed after the copy: conflict.
 * - Withdraw when the server row is otherwise unchanged: mark withdrawn.
 * - Withdraw without a base version while a server link exists: conflict.
 */

export const EARLY_GRACE_MS = 15 * 60 * 1000;
export const LATE_GRACE_MS = 2 * 60 * 60 * 1000;
export const CLOCK_TOLERANCE_MS = 1000;

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

export type SyncDecision =
  | { type: "apply"; reason: string }
  | { type: "noop"; reason: string }
  | { type: "reject"; rule: string; reason: string }
  | { type: "conflict"; rule: string; reason: string };

export type AttendanceLocal = {
  status: AttendanceStatus;
  note: string | null;
  recordedAt: string;
  baseUpdatedAt: string | null;
};

export type AttendanceServer = {
  status: AttendanceStatus;
  note: string | null;
  recordedAt: string;
  updatedAt: string;
} | null;

export type SessionWindow = {
  exists: boolean;
  scheduledAt: string;
  durationMin: number;
};

export type AssignmentLocal = {
  op: "ASSIGN" | "WITHDRAW";
  note: string | null;
  baseUpdatedAt: string | null;
  baseNotes: string | null;
};

export type AssignmentServer = {
  status: string;
  notes: string | null;
  updatedAt: string;
} | null;

function ms(value: string) {
  return new Date(value).getTime();
}

function sameText(left: string | null | undefined, right: string | null | undefined) {
  return (left ?? "").trim() === (right ?? "").trim();
}

export function inSessionWindow(recordedAt: string, session: SessionWindow) {
  const mark = ms(recordedAt);
  const start = ms(session.scheduledAt);
  const end = start + session.durationMin * 60 * 1000;
  return mark >= start - EARLY_GRACE_MS && mark <= end + LATE_GRACE_MS;
}

function serverMoved(baseUpdatedAt: string | null, serverUpdatedAt: string) {
  if (!baseUpdatedAt) return true;
  return ms(serverUpdatedAt) > ms(baseUpdatedAt) + CLOCK_TOLERANCE_MS;
}

export function resolveAttendance(
  local: AttendanceLocal,
  server: AttendanceServer,
  session: SessionWindow,
): SyncDecision {
  if (!session.exists) {
    return {
      type: "conflict",
      rule: "ATTENDANCE_SESSION_MISSING",
      reason: "The session no longer exists. The field mark is held for review.",
    };
  }

  if (!server) {
    return { type: "apply", reason: "No attendance exists on the server yet." };
  }

  if (server.status === local.status && sameText(server.note, local.note)) {
    return { type: "noop", reason: "The server already has this attendance." };
  }

  if (!serverMoved(local.baseUpdatedAt, server.updatedAt)) {
    return {
      type: "apply",
      reason: "The server has not changed since this sheet was opened.",
    };
  }

  const localInside = inSessionWindow(local.recordedAt, session);
  const serverInside = inSessionWindow(server.recordedAt, session);

  if (localInside && !serverInside) {
    return {
      type: "apply",
      reason: "The field mark was taken during the session and replaces an out-of-window edit.",
    };
  }

  if (!localInside) {
    return {
      type: "reject",
      rule: "ATTENDANCE_OUTSIDE_WINDOW",
      reason: "The field mark is outside the session window. The server value stands.",
    };
  }

  return {
    type: "conflict",
    rule: "ATTENDANCE_BOTH_IN_WINDOW",
    reason: "Two different statuses were recorded during the session. Choose which one to keep.",
  };
}

export function resolveAssignment(local: AssignmentLocal, server: AssignmentServer): SyncDecision {
  if (local.op === "ASSIGN") {
    if (!server) {
      return {
        type: "apply",
        reason: "Link the existing beneficiary to this project without copying the person.",
      };
    }
    if (server.status === "active") {
      return { type: "noop", reason: "This beneficiary is already on the project." };
    }
    if (!serverMoved(local.baseUpdatedAt, server.updatedAt)) {
      return { type: "apply", reason: "Restore the assignment from the version opened on the device." };
    }
    return {
      type: "conflict",
      rule: "ASSIGNMENT_REACTIVATE",
      reason: "The server withdrew this assignment after the device copied it. It stays withdrawn until reviewed.",
    };
  }

  if (!server || server.status === "withdrawn") {
    return { type: "noop", reason: "The assignment is already withdrawn." };
  }

  if (!local.baseUpdatedAt) {
    return {
      type: "conflict",
      rule: "ASSIGNMENT_MISSING_BASE",
      reason: "The device asked to withdraw an assignment without a base version. Nothing was removed.",
    };
  }

  if (!serverMoved(local.baseUpdatedAt, server.updatedAt)) {
    return { type: "apply", reason: "Withdraw the assignment. The server copy has not moved." };
  }

  if (!sameText(server.notes, local.baseNotes)) {
    return {
      type: "conflict",
      rule: "ASSIGNMENT_NOTES_DIVERGED",
      reason: "Notes on the server changed after the offline withdraw. The person stays on the project.",
    };
  }

  return { type: "apply", reason: "Withdraw the assignment. Server notes match the device copy." };
}
