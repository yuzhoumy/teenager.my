import { supabase } from "@/lib/supabase";
import type { MaterialGrade, MaterialTag } from "@/types/database";
import type { StudyMaterial } from "@/types/resource";

type SearchParamValue = string | string[] | undefined;

export type MaterialFilters = {
  grade: MaterialGrade | null;
  subjects: string[];
  tags: MaterialTag[];
  origins: string[];
  query: string;
  queryTokens: string[];
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

export const materialGrades: MaterialGrade[] = ["f1", "f2", "f3", "f4", "f5"];
export const materialTags: MaterialTag[] = ["exercise", "notes", "past-year", "trial-paper"];

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

export function getMaterialGradeLabel(grade: MaterialGrade) {
  return materialGradeLabels[grade];
}

export function getMaterialTagLabel(tag: MaterialTag) {
  return materialTagLabels[tag];
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

function normalizeSearchText(value: SearchParamValue) {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join(" ").trim();
  }

  return value?.trim() ?? "";
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function deduceFiltersFromSearch(searchText: string) {
  let normalized = searchText.toLowerCase();
  let grade: MaterialGrade | null = null;
  const tags: MaterialTag[] = [];

  const phraseMatchers = [
    ...materialGrades.flatMap((gradeId) => [
      { phrase: materialGradeLabels[gradeId].toLowerCase(), value: gradeId, type: "grade" as const },
      { phrase: gradeId.toLowerCase(), value: gradeId, type: "grade" as const },
    ]),
    ...materialTags.flatMap((tagId) => [
      { phrase: materialTagLabels[tagId].toLowerCase(), value: tagId, type: "tag" as const },
      { phrase: tagId.toLowerCase(), value: tagId, type: "tag" as const },
    ]),
  ].sort((a, b) => b.phrase.length - a.phrase.length);

  for (const matcher of phraseMatchers) {
    const pattern = new RegExp(`\\b${escapeRegExp(matcher.phrase)}\\b`, "g");
    if (!pattern.test(normalized)) {
      continue;
    }

    normalized = normalized.replace(pattern, " ");

    if (matcher.type === "grade") {
      grade = matcher.value as MaterialGrade;
    } else {
      const tagValue = matcher.value as MaterialTag;
      if (!tags.includes(tagValue)) {
        tags.push(tagValue);
      }
    }
  }

  const queryTokens = normalized
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  return { grade, tags, queryTokens };
}

export function parseMaterialFilters(searchParams: Record<string, SearchParamValue>): MaterialFilters {
  const gradeValue = normalizeSearchParam(searchParams.grade)[0] ?? null;
  const subjects = normalizeSearchParam(searchParams.subjects);
  const tags = normalizeSearchParam(searchParams.tags).filter((tag): tag is MaterialTag =>
    materialTags.includes(tag as MaterialTag),
  );
  const origins = normalizeSearchParam(searchParams.origins);
  const rawSearch = normalizeSearchText(searchParams.query);
  const deduced = rawSearch ? deduceFiltersFromSearch(rawSearch) : { grade: null, tags: [], queryTokens: [] };

  return {
    grade: materialGrades.includes(gradeValue as MaterialGrade)
      ? (gradeValue as MaterialGrade)
      : deduced.grade,
    subjects,
    tags: [...new Set([...tags, ...deduced.tags])],
    origins,
    query: rawSearch,
    queryTokens: deduced.queryTokens,
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
    query = query.contains("category_tags", filters.tags);
  }

  for (const token of filters.queryTokens) {
    query = query.ilike("title", `%${token}%`);
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
