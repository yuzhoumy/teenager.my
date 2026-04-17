import { supabase } from "@/lib/supabase";
import type { MaterialGrade, MaterialTag } from "@/types/database";
import type { TranslationKey } from "@/lib/i18n/messages";
import type { StudyMaterial } from "@/types/resource";

type SearchParamValue = string | string[] | undefined;

export type MaterialFilters = {
  grade: MaterialGrade | null;
  subjects: string[];
  tags: MaterialTag[];
  origins: string[];
};

export type MaterialFacetOption = {
  value: string;
  label: string;
  count: number;
};

export type MaterialFacets = {
  grades: Array<{ value: MaterialGrade; label: string }>;
  subjects: MaterialFacetOption[];
  tags: Array<{ value: MaterialTag; label: string; count: number }>;
  origins: MaterialFacetOption[];
};

type MaterialFacetRow = Pick<StudyMaterial, "grade" | "subject" | "category_tags" | "origin">;

const materialGrades: MaterialGrade[] = ["f1", "f2", "f3", "f4", "f5"];
const materialTags: MaterialTag[] = ["exercise", "notes", "past-year", "trial-paper"];

export const materialGradeLabels: Record<MaterialGrade, string> = {
  f1: "Form 1",
  f2: "Form 2",
  f3: "Form 3",
  f4: "Form 4",
  f5: "Form 5",
};

export const materialTagLabels: Record<MaterialTag, string> = {
  exercise: "Exercise",
  notes: "Notes",
  "past-year": "Past Year",
  "trial-paper": "Trial Paper",
};

const materialGradeToForm: Record<MaterialGrade, number> = {
  f1: 1,
  f2: 2,
  f3: 3,
  f4: 4,
  f5: 5,
};

const materialTagTranslationKeys: Record<MaterialTag, TranslationKey> = {
  exercise: "search.tag.exercise",
  notes: "search.tag.notes",
  "past-year": "search.tag.pastYear",
  "trial-paper": "search.tag.trialPaper",
};

export function getMaterialGradeLabel(
  grade: MaterialGrade,
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string,
) {
  return t("auth.formPrefix", { form: materialGradeToForm[grade] });
}

export function getMaterialTagLabel(
  tag: MaterialTag,
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string,
) {
  return t(materialTagTranslationKeys[tag]);
}

function normalizeSearchParam(value: SearchParamValue) {
  const rawValues = Array.isArray(value) ? value : value ? [value] : [];
  return Array.from(
    new Set(
      rawValues
        .flatMap((entry) => entry.split(","))
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  );
}

export function parseMaterialFilters(searchParams: Record<string, SearchParamValue>): MaterialFilters {
  const gradeValue = normalizeSearchParam(searchParams.grade)[0] ?? null;
  const subjects = normalizeSearchParam(searchParams.subjects);
  const tags = normalizeSearchParam(searchParams.tags).filter((tag): tag is MaterialTag =>
    materialTags.includes(tag as MaterialTag),
  );
  const origins = normalizeSearchParam(searchParams.origins);

  return {
    grade: materialGrades.includes(gradeValue as MaterialGrade) ? (gradeValue as MaterialGrade) : null,
    subjects,
    tags,
    origins,
  };
}

export async function getMaterials(filters: MaterialFilters) {
  let query = supabase
    .from("materials")
    .select("*")
    .order("year", { ascending: false })
    .order("created_at", { ascending: false });

  if (filters.grade) {
    query = query.eq("grade", filters.grade);
  }

  if (filters.subjects.length > 0) {
    query = query.in("subject", filters.subjects);
  }

  if (filters.tags.length > 0) {
    query = query.overlaps("category_tags", filters.tags);
  }

  if (filters.origins.length > 0) {
    query = query.in("origin", filters.origins);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Unable to fetch materials: ${error.message}`);
  }

  return (data ?? []) as StudyMaterial[];
}

export async function getMaterialFacets(): Promise<MaterialFacets> {
  const { data, error } = await supabase
    .from("materials")
    .select("grade, subject, category_tags, origin");

  if (error) {
    throw new Error(`Unable to fetch material facets: ${error.message}`);
  }

  const rows: MaterialFacetRow[] = (data ?? []) as MaterialFacetRow[];
  const subjectCounts = new Map<string, number>();
  const originCounts = new Map<string, number>();
  const tagCounts = new Map<MaterialTag, number>();

  for (const row of rows) {
    subjectCounts.set(row.subject, (subjectCounts.get(row.subject) ?? 0) + 1);
    originCounts.set(row.origin, (originCounts.get(row.origin) ?? 0) + 1);

    for (const tag of row.category_tags) {
      if (!materialTags.includes(tag as MaterialTag)) continue;
      const typedTag = tag as MaterialTag;
      tagCounts.set(typedTag, (tagCounts.get(typedTag) ?? 0) + 1);
    }
  }

  const subjects = Array.from(subjectCounts.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([value, count]) => ({ value, label: value, count }));

  const origins = Array.from(originCounts.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([value, count]) => ({ value, label: value, count }));

  const tags = materialTags
    .filter((tag) => tagCounts.has(tag))
    .map((tag) => ({
      value: tag,
      label: materialTagLabels[tag],
      count: tagCounts.get(tag) ?? 0,
    }));

  return {
    grades: materialGrades.map((value) => ({ value, label: materialGradeLabels[value] })),
    subjects,
    tags,
    origins,
  };
}

export async function getMaterialsSearchPageData(searchParams: Record<string, SearchParamValue>) {
  const filters = parseMaterialFilters(searchParams);
  const [materials, facets] = await Promise.all([
    getMaterials(filters),
    getMaterialFacets(),
  ]);

  return {
    filters,
    facets,
    materials,
  };
}

export function groupMaterialsBySubject(materials: StudyMaterial[]) {
  const grouped = new Map<string, StudyMaterial[]>();

  for (const material of materials) {
    const bucket = grouped.get(material.subject) ?? [];
    bucket.push(material);
    grouped.set(material.subject, bucket);
  }

  return Array.from(grouped.entries()).sort(([left], [right]) => left.localeCompare(right));
}
