"use client";

import { useEffect, useState, type FormEvent } from "react";
import { groupMaterialsBySubject, getMaterialGradeLabel, getMaterialTagLabel } from "@/lib/materials";
import { ResourceCard } from "@/components/resources/resource-card";
import { ResourceFiltersBar } from "@/components/resources/resource-filters";
import { UploadResourceModal } from "@/components/resources/upload-resource-modal";
import { useMaterialFilters, useMaterialsQuery } from "@/components/resources/use-material-filters";

function ActiveFiltersSummary({ filters }: { filters: ReturnType<typeof useMaterialsQuery>["filters"] }) {
  const tokens = [
    filters.grade ? getMaterialGradeLabel(filters.grade) : null,
    ...filters.subjects,
    ...filters.tags.map((tag) => getMaterialTagLabel(tag)),
    ...filters.origins,
  ].filter(Boolean);

  return (
    <div className="flex flex-wrap gap-2">
      {tokens.length > 0 ? (
        tokens.map((token) => (
          <span
            key={token}
            className="rounded-full border border-border-strong bg-surface-muted px-3 py-1 text-xs uppercase tracking-[0.12em] text-text-muted"
          >
            {token}
          </span>
        ))
      ) : (
        <span className="text-sm text-text-muted">Showing all materials</span>
      )}
    </div>
  );
}

export function ResourcesPageClient() {
  const { filters, facets, materials, loading, error } = useMaterialsQuery();
  const { filters: mobileFilters, setSearchText } = useMaterialFilters();
  const [searchInput, setSearchInput] = useState(mobileFilters.query);

  useEffect(() => {
    setSearchInput(mobileFilters.query);
  }, [mobileFilters.query]);

  function handleMobileSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearchText(searchInput);
  }

  if (error && !facets) {
    return (
      <section className="space-y-6">
        <div className="rounded-[30px] border border-border bg-surface p-8 shadow-[0_4px_24px_var(--shadow)]">
          <p className="text-sm uppercase tracking-[0.18em] text-text-soft">Metadata search</p>
          <h1 className="mt-2 text-4xl text-foreground sm:text-5xl">Study materials</h1>
          <div className="mt-4 rounded-2xl border border-[#e7c3b8] bg-[#fff4f0] p-4">
            <h2 className="text-2xl text-foreground">Setup needed</h2>
            <p className="mt-2 text-sm text-[#b53333]">{error}</p>
            <p className="mt-3 text-sm text-text-muted">Please check your Supabase configuration and database setup.</p>
          </div>
        </div>
      </section>
    );
  }

  if (!facets) {
    return (
      <section className="space-y-6">
        <div className="rounded-[30px] border border-border bg-surface p-8 shadow-[0_4px_24px_var(--shadow)]">
          <p className="text-sm uppercase tracking-[0.18em] text-text-soft">Metadata search</p>
          <h1 className="mt-2 text-4xl text-foreground sm:text-5xl">Study materials</h1>
          <p className="mt-3 text-base text-text-muted">Loading search filters...</p>
        </div>
      </section>
    );
  }

  const groupedMaterials = groupMaterialsBySubject(materials);
  const shouldGroupBySubject = filters.subjects.length === 0;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-text-soft">Metadata search</p>
          <h1 className="mt-2 text-4xl text-foreground sm:text-5xl">Study materials</h1>
          <p className="mt-3 max-w-3xl text-base text-text-muted">Filter by grade, subject, tags, and origin with shareable URLs. If no subject is selected, results stay grouped by subject so students can scan the library naturally.</p>
        </div>
        <UploadResourceModal />
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-6">
        <ResourceFiltersBar facets={facets} />

        <div className="space-y-6">
          <form onSubmit={handleMobileSearchSubmit} className="lg:hidden">
            <div className="rounded-[30px] border border-border bg-surface p-5 shadow-[0_4px_24px_var(--shadow)]">
              <label htmlFor="mobile-material-search" className="sr-only">
                Search materials
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  id="mobile-material-search"
                  type="search"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search titles or tags like Form 5, Trial Paper"
                  className="min-w-0 flex-1 rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
                <button
                  type="submit"
                  className="rounded-xl border border-transparent bg-surface-muted px-4 py-3 text-sm font-medium text-foreground shadow-[0_0_0_1px_var(--ring)] hover:bg-[#dfdccf]"
                >
                  Search
                </button>
              </div>
            </div>
          </form>

          <div className="rounded-[30px] border border-border bg-surface p-5 shadow-[0_4px_24px_var(--shadow)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm uppercase tracking-[0.18em] text-text-soft">Results</p>
                <h2 className="mt-2 text-3xl text-foreground">
                  {loading ? "Loading materials..." : `${materials.length} materials`}
                </h2>
              </div>
              <p className="text-sm text-text-muted">Sorted by year</p>
            </div>
            <div className="mt-4">
              <ActiveFiltersSummary filters={filters} />
            </div>
          </div>

          {error ? (
            <div className="rounded-[30px] border border-border bg-surface p-8 text-center shadow-[0_4px_24px_var(--shadow)]">
              <h2 className="text-3xl text-foreground">Error loading materials</h2>
              <p className="mt-3 text-sm text-[#b53333]">{error}</p>
            </div>
          ) : loading ? (
            <div className="rounded-[30px] border border-border bg-surface p-8 text-center shadow-[0_4px_24px_var(--shadow)]">
              <h2 className="text-3xl text-foreground">Fetching materials</h2>
              <p className="mt-3 text-sm text-text-muted">Please wait while we load the study materials...</p>
            </div>
          ) : materials.length === 0 ? (
            <div className="rounded-[30px] border border-border bg-surface p-8 text-center shadow-[0_4px_24px_var(--shadow)]">
              <h2 className="text-3xl text-foreground">No materials found</h2>
              <p className="mt-3 text-sm text-text-muted">Try adjusting your filters or check back later for new uploads.</p>
            </div>
          ) : shouldGroupBySubject ? (
            <div className="space-y-8">
              {groupedMaterials.map(([subject, subjectMaterials]) => (
                <section key={subject} className="space-y-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.18em] text-text-soft">Subject</p>
                    <h2 className="mt-2 text-3xl text-foreground">{subject}</h2>
                  </div>
                  <div className="grid gap-4 xl:grid-cols-2">
                    {subjectMaterials.map((material) => (
                      <ResourceCard key={material.id} material={material} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {materials.map((material) => (
                <ResourceCard key={material.id} material={material} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
