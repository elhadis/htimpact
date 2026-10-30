export type ProgressTarget = {
  metricKey: string;
  label: string;
  targetValue: number;
  unit: string;
};

export type ProgressInput = {
  targets: ProgressTarget[];
  beneficiaryCount: number;
  sessionCount: number;
  attendanceMarked: number;
  attendancePositive: number;
  activityCount: number;
  participationCount: number;
};

export type MetricProgress = {
  metricKey: string;
  label: string;
  target: number;
  actual: number;
  unit: string;
  percent: number;
};

export function actualForMetric(input: ProgressInput, metricKey: string) {
  switch (metricKey) {
    case "beneficiaries":
      return input.beneficiaryCount;
    case "sessions":
      return input.sessionCount;
    case "attendance_rate":
      if (input.attendanceMarked === 0) return 0;
      return Math.round((input.attendancePositive / input.attendanceMarked) * 100);
    case "activities":
      return input.activityCount;
    case "participation":
      return input.participationCount;
    default:
      return 0;
  }
}

export function buildProgress(input: ProgressInput) {
  const metrics: MetricProgress[] = input.targets.map((target) => {
    const actual = actualForMetric(input, target.metricKey);
    const percent =
      target.targetValue <= 0 ? 0 : Math.min(100, Math.round((actual / target.targetValue) * 100));
    return {
      metricKey: target.metricKey,
      label: target.label,
      target: target.targetValue,
      actual,
      unit: target.unit,
      percent,
    };
  });
  const overall =
    metrics.length === 0
      ? 0
      : Math.round(metrics.reduce((sum, metric) => sum + metric.percent, 0) / metrics.length);
  return { overall, metrics };
}

export const EDUCATIONAL_METRICS = ["beneficiaries", "sessions", "attendance_rate"] as const;
export const ACTIVITY_METRICS = ["beneficiaries", "activities", "participation"] as const;

export function metricsForType(type: "EDUCATIONAL" | "NON_EDUCATIONAL") {
  return type === "EDUCATIONAL" ? EDUCATIONAL_METRICS : ACTIVITY_METRICS;
}
