import {
  resolveAssignment,
  resolveAttendance,
  type AssignmentServer,
  type AttendanceServer,
  type SessionWindow,
} from "./rules";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const session: SessionWindow = {
  exists: true,
  scheduledAt: "2026-03-01T09:00:00.000Z",
  durationMin: 60,
};

const inside = "2026-03-01T09:20:00.000Z";
const outside = "2026-03-03T09:20:00.000Z";

function serverAttendance(overrides: Partial<NonNullable<AttendanceServer>> = {}): AttendanceServer {
  return {
    status: "ABSENT",
    note: null,
    recordedAt: outside,
    updatedAt: "2026-03-01T12:00:00.000Z",
    ...overrides,
  };
}

assert(
  resolveAttendance(
    { status: "PRESENT", note: null, recordedAt: inside, baseUpdatedAt: null },
    null,
    session,
  ).type === "apply",
  "insert when server is empty",
);

assert(
  resolveAttendance(
    { status: "ABSENT", note: null, recordedAt: inside, baseUpdatedAt: "2026-03-01T12:00:00.000Z" },
    serverAttendance(),
    session,
  ).type === "noop",
  "identical attendance is a no-op",
);

assert(
  resolveAttendance(
    { status: "PRESENT", note: null, recordedAt: inside, baseUpdatedAt: "2026-03-01T12:00:00.000Z" },
    serverAttendance(),
    session,
  ).type === "apply",
  "unchanged server accepts the field mark",
);

assert(
  resolveAttendance(
    { status: "PRESENT", note: null, recordedAt: inside, baseUpdatedAt: "2026-03-01T08:00:00.000Z" },
    serverAttendance({ recordedAt: outside }),
    session,
  ).type === "apply",
  "in-window field mark overrides an out-of-window server edit",
);

const rejected = resolveAttendance(
  { status: "PRESENT", note: null, recordedAt: outside, baseUpdatedAt: "2026-03-01T08:00:00.000Z" },
  serverAttendance({ recordedAt: inside, status: "LATE" }),
  session,
);
assert(rejected.type === "reject" && rejected.rule === "ATTENDANCE_OUTSIDE_WINDOW", "outside field mark loses");

const conflict = resolveAttendance(
  { status: "PRESENT", note: null, recordedAt: inside, baseUpdatedAt: "2026-03-01T08:00:00.000Z" },
  serverAttendance({ recordedAt: "2026-03-01T09:40:00.000Z", status: "LATE" }),
  session,
);
assert(
  conflict.type === "conflict" && conflict.rule === "ATTENDANCE_BOTH_IN_WINDOW",
  "both in-window marks conflict",
);

assert(
  resolveAttendance(
    { status: "PRESENT", note: null, recordedAt: inside, baseUpdatedAt: null },
    null,
    { ...session, exists: false },
  ).type === "conflict",
  "missing session is held",
);

assert(
  resolveAssignment(
    { op: "ASSIGN", note: null, baseUpdatedAt: null, baseNotes: null },
    null,
  ).type === "apply",
  "new assignment applies",
);

const active: AssignmentServer = {
  status: "active",
  notes: "keep",
  updatedAt: "2026-03-01T12:00:00.000Z",
};
assert(
  resolveAssignment(
    { op: "ASSIGN", note: null, baseUpdatedAt: null, baseNotes: null },
    active,
  ).type === "noop",
  "active assignment is idempotent",
);

const withdrawn: AssignmentServer = {
  status: "withdrawn",
  notes: null,
  updatedAt: "2026-03-02T12:00:00.000Z",
};
const reactivate = resolveAssignment(
  { op: "ASSIGN", note: null, baseUpdatedAt: "2026-03-01T12:00:00.000Z", baseNotes: null },
  withdrawn,
);
assert(reactivate.type === "conflict" && reactivate.rule === "ASSIGNMENT_REACTIVATE", "do not silently reactivate");

assert(
  resolveAssignment(
    { op: "WITHDRAW", note: null, baseUpdatedAt: "2026-03-01T12:00:00.000Z", baseNotes: "keep" },
    active,
  ).type === "apply",
  "withdraw applies when the server has not moved",
);

const notes = resolveAssignment(
  { op: "WITHDRAW", note: null, baseUpdatedAt: "2026-03-01T08:00:00.000Z", baseNotes: "old" },
  active,
);
assert(notes.type === "conflict" && notes.rule === "ASSIGNMENT_NOTES_DIVERGED", "diverged notes conflict");

console.log("conflict rules ok");
