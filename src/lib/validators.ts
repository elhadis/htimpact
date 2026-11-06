import { z } from "zod";
import { ROLES } from "@/lib/rbac";

export const projectTypes = ["EDUCATIONAL", "NON_EDUCATIONAL"] as const;
export const projectStatuses = ["DRAFT", "ACTIVE", "ON_HOLD", "COMPLETED", "ARCHIVED"] as const;
export const genders = ["FEMALE", "MALE", "OTHER", "UNSPECIFIED"] as const;
export const attendanceStatuses = ["PRESENT", "ABSENT", "LATE", "EXCUSED"] as const;
export const assignmentStatuses = ["active", "completed", "withdrawn"] as const;

const requiredText = z.string().trim().min(2, "min").max(160, "max");
const optionalText = z.string().trim().max(2000, "max").optional().or(z.literal(""));

export const targetSchema = z.object({
  metricKey: z.enum([
    "beneficiaries",
    "sessions",
    "attendance_rate",
    "activities",
    "participation",
  ]),
  label: requiredText,
  targetValue: z.coerce.number().int().positive().max(1_000_000),
  unit: requiredText.max(40),
});

export const projectSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2)
      .max(20)
      .regex(/^[A-Za-z0-9-]+$/, "code"),
    name: requiredText,
    description: optionalText,
    type: z.enum(projectTypes),
    status: z.enum(projectStatuses),
    startDate: z.string().min(1),
    endDate: optionalText,
    location: optionalText,
    donor: optionalText,
    targets: z.array(targetSchema).min(1).max(8),
  })
  .superRefine((value, ctx) => {
    if (value.endDate && value.endDate < value.startDate) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "endBeforeStart" });
    }
    const keys = value.targets.map((target) => target.metricKey);
    if (new Set(keys).size !== keys.length) {
      ctx.addIssue({ code: "custom", path: ["targets"], message: "duplicateMetric" });
    }
  });

export const beneficiarySchema = z.object({
  centerId: z.string().optional(),
  firstName: requiredText,
  lastName: requiredText,
  gender: z.enum(genders),
  dateOfBirth: optionalText,
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  nationalId: z.string().trim().max(40).optional().or(z.literal("")),
  community: optionalText,
  notes: optionalText,
  projectIds: z.array(z.string()).default([]),
});

export const courseSchema = z.object({
  projectId: z.string().min(1),
  code: z
    .string()
    .trim()
    .min(2)
    .max(20)
    .regex(/^[A-Za-z0-9-]+$/),
  name: requiredText,
  description: optionalText,
  hours: z.union([z.literal(""), z.coerce.number().int().positive().max(5000)]).optional(),
});

export const cohortSchema = z.object({
  centerId: z.string().optional(),
  courseId: z.string().min(1),
  name: requiredText,
  startDate: z.string().min(1),
  endDate: optionalText,
  capacity: z.union([z.literal(""), z.coerce.number().int().positive().max(5000)]).optional(),
  location: optionalText,
});

export const sessionSchema = z.object({
  cohortId: z.string().min(1),
  title: requiredText,
  scheduledAt: z.string().min(1),
  durationMin: z.coerce.number().int().positive().max(720),
  location: optionalText,
  facilitatorId: z.string().optional().or(z.literal("")),
  notes: optionalText,
});

export const activitySchema = z.object({
  centerId: z.string().optional(),
  projectId: z.string().min(1),
  name: requiredText,
  description: optionalText,
  scheduledAt: optionalText,
  location: optionalText,
});

export const staffSchema = z.object({
  centerId: z.string().optional(),
  name: requiredText,
  email: z.string().trim().email("email"),
  password: z.string().min(8, "password").max(80, "max"),
  role: z.enum(ROLES),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  title: z.string().trim().max(80).optional().or(z.literal("")),
  projectIds: z.array(z.string()).default([]),
});

export const staffUpdateSchema = staffSchema.omit({ password: true, email: true }).extend({
  active: z.boolean(),
  email: z.string().trim().email("email"),
});

export const loginSchema = z.object({
  email: z.string().trim().email("email"),
  password: z.string().min(4, "password").max(80, "max"),
});

export const attendanceRowSchema = z.object({
  beneficiaryId: z.string().min(1),
  status: z.enum(attendanceStatuses),
  note: z.string().trim().max(500).optional().or(z.literal("")),
  baseUpdatedAt: z.string().nullable(),
  recordedAt: z.string().min(1),
  clientMutationId: z.string().min(8),
});

export const assignmentMutationSchema = z.object({
  projectId: z.string().min(1),
  beneficiaryId: z.string().min(1),
  op: z.enum(["ASSIGN", "WITHDRAW"]),
  note: z.string().trim().max(500).optional().or(z.literal("")),
  baseUpdatedAt: z.string().nullable(),
  baseNotes: z.string().nullable(),
  clientMutationId: z.string().min(8),
});

export type ProjectInput = z.infer<typeof projectSchema>;
export type BeneficiaryInput = z.infer<typeof beneficiarySchema>;
export type CourseInput = z.infer<typeof courseSchema>;
export type CohortInput = z.infer<typeof cohortSchema>;
export type SessionInput = z.infer<typeof sessionSchema>;
export type ActivityInput = z.infer<typeof activitySchema>;
export type StaffInput = z.infer<typeof staffSchema>;
export type StaffUpdateInput = z.infer<typeof staffUpdateSchema>;

export const centerSchema = z.object({
  id: z.string().optional(),
  code: z.string().trim().min(2).max(20).regex(/^[A-Za-z0-9-]+$/),
  name: requiredText,
  location: optionalText,
  active: z.boolean().default(true),
  projectIds: z.array(z.string()).default([]),
  managerIds: z.array(z.string()).default([]),
});
export const transferSchema = z.object({
  id: z.string().uuid(),
  beneficiaryId: z.string().min(1),
  fromCenterId: z.string().min(1),
  toCenterId: z.string().min(1),
  reason: z.string().trim().max(1000).optional(),
});
