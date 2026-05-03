"use client";

import { useEffect, useMemo, useState } from "react";
import { startTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { MaterialCoreType, MaterialGrade, MaterialTag } from "@/types/database";
import type { StudyMaterial } from "@/types/resource";
import {
  getMaterialFacets,
  getMaterials,
  parseMaterialFilters,
  type MaterialFacets,
} from "@/lib/materials";

function toggleValue(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((entry) => entry !== value)
    : [...values, value];
}

export function useMaterialFilters() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const filters = useMemo(
    () =>
      parseMaterialFilters({
        grade: searchParams.get("grade") ?? undefined,
        coreTypes: searchParams.getAll("coreTypes"),
        subjects: searchParams.getAll("subjects"),
        tags: searchParams.getAll("tags"),
        origins: searchParams.getAll("origins"),
        query: searchParams.get("query") ?? undefined,
      }),
    [searchParams],
  );

  function replaceFilters(next: typeof filters) {
    const params = new URLSearchParams();

    if (next.grade) {
      params.set("grade", next.grade);
    }

    for (const coreType of next.coreTypes) {
      params.append("coreTypes", coreType);
    }

    for (const subject of next.subjects) {
      params.append("subjects", subject);
    }

    for (const tag of next.tags) {
      params.append("tags", tag);
    }

    for (const origin of next.origins) {
      params.append("origins", origin);
    }

    if (next.query.trim().length > 0) {
      params.set("query", next.query);
    }

    const query = params.toString();
    const href = query ? `${pathname}?${query}` : pathname;

    startTransition(() => {
      router.replace(href, { scroll: false });
    });
  }

  return {
    filters,
    setGrade(nextGrade: MaterialGrade | null) {
      replaceFilters({ ...filters, grade: nextGrade });
    },
    toggleCoreType(coreType: MaterialCoreType) {
      replaceFilters({ ...filters, coreTypes: toggleValue(filters.coreTypes, coreType) as MaterialCoreType[] });
    },
    toggleSubject(subject: string) {
      replaceFilters({ ...filters, subjects: toggleValue(filters.subjects, subject) });
    },
    toggleTag(tag: MaterialTag) {
      replaceFilters({ ...filters, tags: toggleValue(filters.tags, tag) as MaterialTag[] });
    },
    toggleOrigin(origin: string) {
      replaceFilters({ ...filters, origins: toggleValue(filters.origins, origin) });
    },
    setSearchText(nextSearch: string) {
      replaceFilters({ ...filters, query: nextSearch });
    },
    clearAll() {
      replaceFilters({
        grade: null,
        coreTypes: [],
        subjects: [],
        tags: [],
        origins: [],
        query: "",
        queryTokens: [],
      });
    },
  };
}

export function useMaterialsQuery() {
  const { filters } = useMaterialFilters();
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [facets, setFacets] = useState<MaterialFacets | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const filterKey = [
    filters.grade ?? "",
    filters.coreTypes.join("|"),
    filters.subjects.join("|"),
    filters.tags.join("|"),
    filters.origins.join("|"),
    filters.query,
  ].join("::");

  useEffect(() => {
    let cancelled = false;

    async function loadFacets() {
      try {
        const nextFacets = await getMaterialFacets();
        if (!cancelled) {
          setFacets(nextFacets);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load search facets.");
        }
      }
    }

    void loadFacets();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadMaterials() {
      setLoading(true);
      setError(null);

      try {
        const nextMaterials = await getMaterials(filters);
        if (!cancelled) {
          setMaterials(nextMaterials);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load materials.");
          setMaterials([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadMaterials();

    return () => {
      cancelled = true;
    };
  }, [filterKey, filters]);

  return {
    filters,
    facets,
    materials,
    loading,
    error,
  };
}
