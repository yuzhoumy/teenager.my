export const educationLevels = [
  { value: "y1", label: "Year 1" },
  { value: "y2", label: "Year 2" },
  { value: "y3", label: "Year 3" },
  { value: "y4", label: "Year 4" },
  { value: "y5", label: "Year 5" },
  { value: "y6", label: "Year 6" },
  { value: "f1", label: "Form 1" },
  { value: "f2", label: "Form 2" },
  { value: "f3", label: "Form 3" },
  { value: "f4", label: "Form 4" },
  { value: "f5", label: "Form 5" },
  { value: "university", label: "University" },
  { value: "graduated", label: "Graduated" },
] as const;

export type EducationLevel = (typeof educationLevels)[number]["value"];

export function normalizeEducationLevel(value: unknown): EducationLevel {
  if (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5) {
    return `f${value}` as EducationLevel;
  }

  if (typeof value === "string") {
    const trimmed = value.trim().toLowerCase();
    const legacyNumber = Number(trimmed);
    if (Number.isInteger(legacyNumber) && legacyNumber >= 1 && legacyNumber <= 5) {
      return `f${legacyNumber}` as EducationLevel;
    }

    if (educationLevels.some((level) => level.value === trimmed)) {
      return trimmed as EducationLevel;
    }
  }

  return "f1";
}

export function getEducationLevelLabel(value: unknown) {
  const normalized = normalizeEducationLevel(value);
  return educationLevels.find((level) => level.value === normalized)?.label ?? "Form 1";
}
