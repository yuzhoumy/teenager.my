"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { MaterialGrade, MaterialTag } from "@/types/database";
import { getMaterialGradeLabel, getMaterialTagLabel, type MaterialFacets } from "@/lib/materials";
import { useMaterialFilters } from "@/components/resources/use-material-filters";
import { Button } from "@/components/ui/button";

type Props = {
  facets: MaterialFacets;
};

function FilterSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 border-t border-border pt-4 first:border-t-0 first:pt-0">
      <h2 className="text-lg text-foreground">{title}</h2>
      {children}
    </section>
  );
}

export function ResourceFiltersBar({ facets }: Props) {
  const { filters, setGrade, toggleSubject, toggleTag, toggleOrigin, setSearchText, clearAll } = useMaterialFilters();
  const [searchInput, setSearchInput] = useState(filters.query);
  const [mobileOpen, setMobileOpen] = useState(true);

  useEffect(() => {
    setSearchInput(filters.query);
  }, [filters.query]);

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearchText(searchInput);
  }

  return (
    <aside className="rounded-[30px] border border-border bg-surface p-5 shadow-[0_4px_24px_var(--shadow)] lg:sticky lg:top-28">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-text-soft">Filters</p>
          <h2 className="mt-2 text-3xl text-foreground">Find materials</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="lg:hidden"
            onClick={() => setMobileOpen((prev) => !prev)}
          >
            {mobileOpen ? "Hide filters" : "Show filters"}
          </Button>
          <button
            type="button"
            onClick={clearAll}
            className="text-sm font-medium text-brand hover:text-brand-soft"
          >
            Clear all
          </button>
        </div>
      </div>

      <div className={`${mobileOpen ? "space-y-4" : "hidden"} lg:block lg:space-y-4`}>
        <FilterSection title="Search">
          <form onSubmit={handleSearchSubmit} className="space-y-2">
            <label htmlFor="material-search" className="sr-only">
              Search materials
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <input
                id="material-search"
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search titles or type tags like Form 5, Trial Paper"
                className="min-w-0 flex-1 rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
              <Button type="submit" variant="secondary" size="sm" className="whitespace-nowrap">
                Search
              </Button>
            </div>
          </form>
        </FilterSection>

        <FilterSection title="Grade">
          <div className="space-y-2">
            <label className="flex items-center gap-3 text-sm text-text-muted">
              <input
                type="radio"
                name="grade"
                checked={filters.grade === null}
                onChange={() => setGrade(null)}
                className="h-4 w-4 accent-[var(--brand)]"
              />
              All grades
            </label>
            {facets.grades.map((grade) => (
              <label key={grade.value} className="flex items-center gap-3 text-sm text-text-muted">
                <input
                  type="radio"
                  name="grade"
                  checked={filters.grade === grade.value}
                  onChange={() => setGrade(grade.value as MaterialGrade)}
                  className="h-4 w-4 accent-[var(--brand)]"
                />
                {getMaterialGradeLabel(grade.value as MaterialGrade)}
              </label>
            ))}
          </div>
        </FilterSection>

        <FilterSection title="Subjects">
          <div className="space-y-2">
            {facets.subjects.map((subject) => (
              <label key={subject.value} className="flex items-center justify-between gap-3 text-sm text-text-muted">
                <span className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={filters.subjects.includes(subject.value)}
                    onChange={() => toggleSubject(subject.value)}
                    className="h-4 w-4 rounded accent-[var(--brand)]"
                  />
                  {subject.label}
                </span>
                <span className="text-xs text-text-soft">{subject.count}</span>
              </label>
            ))}
          </div>
        </FilterSection>

        <FilterSection title="Tags">
          <div className="space-y-2">
            {facets.tags.map((tag) => (
              <label key={tag.value} className="flex items-center justify-between gap-3 text-sm text-text-muted">
                <span className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={filters.tags.includes(tag.value as MaterialTag)}
                    onChange={() => toggleTag(tag.value as MaterialTag)}
                    className="h-4 w-4 rounded accent-[var(--brand)]"
                  />
                  {getMaterialTagLabel(tag.value as MaterialTag)}
                </span>
                <span className="text-xs text-text-soft">{tag.count}</span>
              </label>
            ))}
          </div>
        </FilterSection>

        <FilterSection title="Origin">
          <div className="space-y-2">
            {facets.origins.map((origin) => (
              <label key={origin.value} className="flex items-center justify-between gap-3 text-sm text-text-muted">
                <span className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={filters.origins.includes(origin.value)}
                    onChange={() => toggleOrigin(origin.value)}
                    className="h-4 w-4 rounded accent-[var(--brand)]"
                  />
                  {origin.label}
                </span>
                <span className="text-xs text-text-soft">{origin.count}</span>
              </label>
            ))}
          </div>
        </FilterSection>
      </div>
    </aside>
  );
}
