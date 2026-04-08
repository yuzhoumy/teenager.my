"use client";

import { useMemo, useState } from "react";
import { seedResources } from "@/lib/seed-resources";
import { ResourceCard } from "@/components/resources/resource-card";
import {
  ResourceFiltersBar,
  type ResourceFilters,
} from "@/components/resources/resource-filters";
import { UploadResourceModal } from "@/components/resources/upload-resource-modal";
import { Button } from "@/components/ui/button";
import { usePreferences } from "@/components/preferences/preferences-provider";

const initialFilters: ResourceFilters = {
  search: "",
  subject: "",
  formLevel: "",
  category: "",
  year: "",
  sortBy: "latest",
};

const pageSize = 6;

export function ResourcesPageClient() {
  const { t } = usePreferences();
  const [filters, setFilters] = useState<ResourceFilters>(initialFilters);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const list = seedResources.filter((resource) => {
      const matchesSearch = !filters.search
        ? true
        : resource.title.toLowerCase().includes(filters.search.toLowerCase());
      const matchesSubject = !filters.subject
        ? true
        : resource.subject.toLowerCase().includes(filters.subject.toLowerCase());
      const matchesForm = !filters.formLevel
        ? true
        : String(resource.form_level) === filters.formLevel;
      const matchesCategory = !filters.category
        ? true
        : resource.category === filters.category;
      const matchesYear = !filters.year
        ? true
        : String(resource.year).includes(filters.year);

      return (
        matchesSearch &&
        matchesSubject &&
        matchesForm &&
        matchesCategory &&
        matchesYear
      );
    });

    list.sort((a, b) => {
      if (filters.sortBy === "downloads") {
        return b.downloads - a.downloads;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return list;
  }, [filters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pagedResources = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("resources.title")}</h1>
          <p className="text-sm text-foreground/70">{t("resources.subtitle")}</p>
        </div>
        <UploadResourceModal />
      </div>
      <ResourceFiltersBar
        filters={filters}
        onChange={(next) => {
          setFilters(next);
          setPage(1);
        }}
      />
      <div className="grid gap-3 md:grid-cols-2">
        {pagedResources.map((resource) => (
          <ResourceCard key={resource.id} resource={resource} />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-foreground/70">
          {t("resources.pagination.pageOf", { page, totalPages })}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page === 1}
          >
            {t("resources.pagination.previous")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={page === totalPages}
          >
            {t("resources.pagination.next")}
          </Button>
        </div>
      </div>
    </section>
  );
}
