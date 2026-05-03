import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { MaterialCoreType, MaterialGrade, MaterialTag } from "@/types/database";
import type { StudyMaterial } from "@/types/resource";

type SearchParamValue = string | string[] | undefined;

export type MaterialFilters = {
  grade: MaterialGrade | null;
  coreTypes: MaterialCoreType[];
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
  coreTypes: Array<{ value: MaterialCoreType; label: string; count: number }>;
  subjects: MaterialFacetOption[];
  tags: Array<{ value: MaterialTag; label: string; count: number }>;
  origins: MaterialFacetOption[];
};

type MaterialFacetRow = Pick<StudyMaterial, "grade" | "core_type" | "subject" | "category_tags" | "origin">;

export const materialGrades: MaterialGrade[] = ["f1", "f2", "f3", "f4", "f5"];
export const materialCoreTypes: MaterialCoreType[] = ["exercise", "note"];
export const materialTags: MaterialTag[] = ["past-year", "trial-paper"];

export const materialGradeLabels: Record<MaterialGrade, string> = {
  f1: "Form 1",
  f2: "Form 2",
  f3: "Form 3",
  f4: "Form 4",
  f5: "Form 5",
};

export const materialCoreTypeLabels: Record<MaterialCoreType, string> = {
  exercise: "Exercise",
  note: "Note",
};

export const materialTagLabels: Record<MaterialTag, string> = {
  "past-year": "Past Year",
  "trial-paper": "Trial Paper",
};

const fallbackMaterials: StudyMaterial[] = [
  {
    id: "fallback-1",
    slug: "spm-trial-add-maths-2024-johor",
    title: "SPM Trial Add Maths 2024 - Johor",
    core_type: "exercise",
    content_markdown:
      "# Overview\n- State trial paper prepared for late-year revision.\n- Focus on calculus, differentiation, and graph interpretation.\n\n## Attachment\n[Open the paper](#)",
    grade: "f5",
    subject: "Additional Mathematics",
    category_tags: ["trial-paper"],
    year: 2024,
    origin: "Johor",
    author_name: "Johor Academic Panel",
    uploaded_by: null,
    created_at: "2025-01-01T00:00:00.000Z",
  },
  {
    id: "fallback-2",
    slug: "mrsm-physics-past-year-2023",
    title: "MRSM Physics Past Year 2023",
    core_type: "exercise",
    content_markdown:
      "# Overview\n- Past-year set with structured and objective sections.\n- Useful for time-based drilling before finals.\n\n## Attachment\n[Open the paper](#)",
    grade: "f5",
    subject: "Physics",
    category_tags: ["past-year"],
    year: 2023,
    origin: "MRSM",
    author_name: "MRSM Physics Department",
    uploaded_by: null,
    created_at: "2025-01-02T00:00:00.000Z",
  },
  {
    id: "fallback-3",
    slug: "form-4-biology-exercise-set-respiration",
    title: "Form 4 Biology Exercise Set - Respiration",
    core_type: "exercise",
    content_markdown:
      "# Overview\n- Topic drill on aerobic and anaerobic respiration.\n- Includes short-answer prompts and structured explanation questions.\n\n## Attachment\n[Open the worksheet](#)",
    grade: "f4",
    subject: "Biology",
    category_tags: [],
    year: 2025,
    origin: "SBP",
    author_name: "Pn. Aisyah Rahman",
    uploaded_by: null,
    created_at: "2025-01-03T00:00:00.000Z",
  },
  {
    id: "fallback-4",
    slug: "spm-sejarah-past-year-2022",
    title: "SPM Sejarah Past Year 2022",
    core_type: "exercise",
    content_markdown:
      "# Overview\n- Official-style past-year paper for SPM preparation.\n- Best paired with answer discussion after each timed session.\n\n## Attachment\n[Open the paper](#)",
    grade: "f5",
    subject: "Sejarah",
    category_tags: ["past-year"],
    year: 2022,
    origin: "State",
    author_name: "Sejarah Teachers Network",
    uploaded_by: null,
    created_at: "2025-01-04T00:00:00.000Z",
  },
  {
    id: "fallback-5",
    slug: "form-5-english-trial-paper-negeri-sembilan",
    title: "Form 5 English Trial Paper - Negeri Sembilan",
    core_type: "exercise",
    content_markdown:
      "# Overview\n- Trial paper with reading, writing, and grammar sections.\n- Good for simulating a full-paper attempt in one sitting.\n\n## Attachment\n[Open the paper](#)",
    grade: "f5",
    subject: "English",
    category_tags: ["trial-paper"],
    year: 2024,
    origin: "Negeri Sembilan",
    author_name: "Negeri Sembilan English Unit",
    uploaded_by: null,
    created_at: "2025-01-05T00:00:00.000Z",
  },
  {
    id: "fallback-6",
    slug: "form-3-mathematics-notes-algebra",
    title: "Form 3 Mathematics Notes - Algebra",
    core_type: "note",
    content_markdown:
      "# Overview\n- Compact revision notes for algebraic expressions and factorisation.\n- Written as a quick refresher before attempting practice questions.\n\n## Attachment\n[Open the attachment](#)",
    grade: "f3",
    subject: "Mathematics",
    category_tags: [],
    year: 2025,
    origin: "teacher-share",
    author_name: "Cikgu Farah",
    uploaded_by: null,
    created_at: "2025-01-06T00:00:00.000Z",
  },
];

export function getMaterialGradeLabel(grade: MaterialGrade) {
  return materialGradeLabels[grade];
}

export function getMaterialCoreTypeLabel(coreType: MaterialCoreType) {
  return materialCoreTypeLabels[coreType];
}

export function getMaterialTagLabel(tag: MaterialTag) {
  return materialTagLabels[tag];
}

export function getMaterialHref(material: Pick<StudyMaterial, "slug">) {
  return `/resources/${material.slug}`;
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
  const coreTypes: MaterialCoreType[] = [];
  const tags: MaterialTag[] = [];

  const phraseMatchers = [
    ...materialGrades.flatMap((gradeId) => [
      { phrase: materialGradeLabels[gradeId].toLowerCase(), value: gradeId, type: "grade" as const },
      { phrase: gradeId.toLowerCase(), value: gradeId, type: "grade" as const },
    ]),
    ...materialCoreTypes.flatMap((coreTypeId) => {
      const label = materialCoreTypeLabels[coreTypeId].toLowerCase();
      const aliases = coreTypeId === "note" ? [label, "notes"] : [label, "exercises"];

      return aliases.map((phrase) => ({
        phrase,
        value: coreTypeId,
        type: "coreType" as const,
      }));
    }),
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
    } else if (matcher.type === "coreType") {
      const coreTypeValue = matcher.value as MaterialCoreType;
      if (!coreTypes.includes(coreTypeValue)) {
        coreTypes.push(coreTypeValue);
      }
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

  return { grade, coreTypes, tags, queryTokens };
}

export function parseMaterialFilters(searchParams: Record<string, SearchParamValue>): MaterialFilters {
  const gradeValue = normalizeSearchParam(searchParams.grade)[0] ?? null;
  const coreTypes = normalizeSearchParam(searchParams.coreTypes).filter((coreType): coreType is MaterialCoreType =>
    materialCoreTypes.includes(coreType as MaterialCoreType),
  );
  const subjects = normalizeSearchParam(searchParams.subjects);
  const tags = normalizeSearchParam(searchParams.tags).filter((tag): tag is MaterialTag =>
    materialTags.includes(tag as MaterialTag),
  );
  const origins = normalizeSearchParam(searchParams.origins);
  const rawSearch = normalizeSearchText(searchParams.query);
  const deduced = rawSearch
    ? deduceFiltersFromSearch(rawSearch)
    : { grade: null, coreTypes: [], tags: [], queryTokens: [] };

  return {
    grade: materialGrades.includes(gradeValue as MaterialGrade)
      ? (gradeValue as MaterialGrade)
      : deduced.grade,
    coreTypes: [...new Set([...coreTypes, ...deduced.coreTypes])],
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

  if (filters.coreTypes.length > 0) {
    query = query.in("core_type", filters.coreTypes);
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
    .select("grade, core_type, subject, category_tags, origin");

  if (error) {
    throw new Error(`Unable to fetch material facets: ${error.message}`);
  }

  const rows: MaterialFacetRow[] = (data ?? []) as MaterialFacetRow[];
  const coreTypeCounts = new Map<MaterialCoreType, number>();
  const subjectCounts = new Map<string, number>();
  const originCounts = new Map<string, number>();
  const tagCounts = new Map<MaterialTag, number>();

  for (const row of rows) {
    if (materialCoreTypes.includes(row.core_type as MaterialCoreType)) {
      const typedCoreType = row.core_type as MaterialCoreType;
      coreTypeCounts.set(typedCoreType, (coreTypeCounts.get(typedCoreType) ?? 0) + 1);
    }

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

  const coreTypes = materialCoreTypes
    .filter((coreType) => coreTypeCounts.has(coreType))
    .map((coreType) => ({
      value: coreType,
      label: materialCoreTypeLabels[coreType],
      count: coreTypeCounts.get(coreType) ?? 0,
    }));

  const tags = materialTags
    .filter((tag) => tagCounts.has(tag))
    .map((tag) => ({
      value: tag,
      label: materialTagLabels[tag],
      count: tagCounts.get(tag) ?? 0,
    }));

  return {
    grades: materialGrades.map((value) => ({ value, label: materialGradeLabels[value] })),
    coreTypes,
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

export async function getMaterialBySlug(slug: string) {
  const { data, error } = await supabase
    .from("materials")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    return fallbackMaterials.find((material) => material.slug === slug) ?? null;
  }

  return (data as StudyMaterial | null) ?? null;
}

export async function getMaterialSlugs() {
  if (!isSupabaseConfigured) {
    return [];
  }

  const { data, error } = await supabase
    .from("materials")
    .select("slug")
    .order("created_at", { ascending: false });

  if (error) {
    return fallbackMaterials.map((material) => ({ slug: material.slug }));
  }

  return (data ?? []) as Array<Pick<StudyMaterial, "slug">>;
}
