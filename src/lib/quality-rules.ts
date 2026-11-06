export type QualityPerson = {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date | null;
  phone: string | null;
};
export type DuplicateGroup = {
  people: { id: string; code: string; name: string }[];
  reasons: ("nameBirthDate" | "namePhone")[];
};

function nameKey(person: QualityPerson) {
  return `${person.firstName} ${person.lastName}`.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
}
function phoneKey(value: string | null) {
  return (value ?? "").normalize("NFKC").replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x6f0)).replace(/\D/g, "");
}
// These are review candidates, never a decision that two records are one person.
// Names alone and blank matching fields are intentionally insufficient.
export function possibleDuplicates(people: QualityPerson[]): DuplicateGroup[] {
  const buckets = new Map<string, { reason: DuplicateGroup["reasons"][number]; people: QualityPerson[] }>();
  for (const person of people) {
    const name = nameKey(person);
    if (!name) continue;
    const keys: [string, DuplicateGroup["reasons"][number]][] = [];
    if (person.dateOfBirth) keys.push([`${name}|dob:${person.dateOfBirth.toISOString().slice(0, 10)}`, "nameBirthDate"]);
    const phone = phoneKey(person.phone);
    if (phone.length >= 7) keys.push([`${name}|phone:${phone}`, "namePhone"]);
    for (const [key, reason] of keys) {
      const bucket = buckets.get(key) ?? { reason, people: [] };
      bucket.people.push(person); buckets.set(key, bucket);
    }
  }
  const groups = new Map<string, DuplicateGroup>();
  for (const bucket of buckets.values()) {
    if (bucket.people.length < 2) continue;
    const key = bucket.people.map((person) => person.id).sort().join("|");
    const existing = groups.get(key);
    if (existing) existing.reasons.push(bucket.reason);
    else groups.set(key, { reasons: [bucket.reason], people: bucket.people.map((person) => ({ id: person.id, code: person.code, name: `${person.firstName} ${person.lastName}` })) });
  }
  return [...groups.values()];
}

export function missingAttendance(session: {
  scheduledAt: Date;
  durationMin: number;
  cohort: { enrollments: { beneficiaryId: string; enrolledAt: Date }[] };
  attendance: { beneficiaryId: string }[];
}, now: Date) {
  if (session.scheduledAt.getTime() + session.durationMin * 60_000 > now.getTime()) return 0;
  const expected = new Set(session.cohort.enrollments.filter((row) => row.enrolledAt <= session.scheduledAt).map((row) => row.beneficiaryId));
  for (const row of session.attendance) expected.delete(row.beneficiaryId);
  return expected.size;
}
