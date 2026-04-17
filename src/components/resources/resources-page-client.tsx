"use client";

import { groupMaterialsBySubject, getMaterialGradeLabel, getMaterialTagLabel } from "@/lib/materials";
import { ResourceCard } from "@/components/resources/resource-card";
import { ResourceFiltersBar } from "@/components/resources/resource-filters";
import { UploadResourceModal } from "@/components/resources/upload-resource-modal";
import { useMaterialsQuery } from "@/components/resources/use-material-filters";
import { usePreferences } from "@/components/preferences/preferences-provider";

function ActiveFiltersSummary({ filters }: { filters: ReturnType<typeof useMaterialsQuery>["filters"] }) {
  const { t } = usePreferences();
  const tokens = [
    filters.grade ? getMaterialGradeLabel(filters.grade, t) : null,
    ...filters.subjects,
    ...filters.tags.map((tag) => getMaterialTagLabel(tag, t)),
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
        <span className="text-sm text-text-muted">{t("search.showingAllMaterials")}</span>
      )}
    </div>
  );
}

export function ResourcesPageClient() {
  const { t } = usePreferences();
  const { filters, facets, materials, loading, error } = useMaterialsQuery();

  if (error && !facets) {
    return (
      <section className="space-y-6">
        <div className="rounded-[30px] border border-border bg-surface p-8 shadow-[0_4px_24px_var(--shadow)]">
          <p className="text-sm uppercase tracking-[0.18em] text-text-soft">{t("search.overline")}</p>
          <h1 className="mt-2 text-4xl text-foreground sm:text-5xl">{t("search.title")}</h1>
          <div className="mt-4 rounded-2xl border border-[#e7c3b8] bg-[#fff4f0] p-4">
            <h2 className="text-2xl text-foreground">{t("search.setupNeeded")}</h2>
            <p className="mt-2 text-sm text-[#b53333]">{error}</p>
            <p className="mt-3 text-sm text-text-muted">{t("search.setupNeededDescription")}</p>
          </div>
        </div>
      </section>
    );
  }

  if (!facets) {
    return (
      <section className="space-y-6">
        <div className="rounded-[30px] border border-border bg-surface p-8 shadow-[0_4px_24px_var(--shadow)]">
          <p className="text-sm uppercase tracking-[0.18em] text-text-soft">{t("search.overline")}</p>
          <h1 className="mt-2 text-4xl text-foreground sm:text-5xl">{t("search.title")}</h1>
          <p className="mt-3 text-base text-text-muted">{t("search.loadingFacets")}</p>
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
          <p className="text-sm uppercase tracking-[0.18em] text-text-soft">{t("search.overline")}</p>
          <h1 className="mt-2 text-4xl text-foreground sm:text-5xl">{t("search.title")}</h1>
          <p className="mt-3 max-w-3xl text-base text-text-muted">{t("search.description")}</p>
        </div>
        <UploadResourceModal />
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-6">
        <ResourceFiltersBar facets={facets} />

        <div className="space-y-6">
          <div className="rounded-[30px] border border-border bg-surface p-5 shadow-[0_4px_24px_var(--shadow)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm uppercase tracking-[0.18em] text-text-soft">{t("search.results")}</p>
                <h2 className="mt-2 text-3xl text-foreground">
                  {loading ? t("search.loadingMaterials") : t("search.materialCount", { count: materials.length })}
                </h2>
              </div>
              <p className="text-sm text-text-muted">{t("search.sortedByYear")}</p>
            </div>
            <div className="mt-4">
              <ActiveFiltersSummary filters={filters} />
            </div>
          </div>

          {error ? (
            <div className="rounded-[30px] border border-border bg-surface p-8 text-center shadow-[0_4px_24px_var(--shadow)]">
              <h2 className="text-3xl text-foreground">{t("search.errorTitle")}</h2>
              <p className="mt-3 text-sm text-[#b53333]">{error}</p>
            </div>
          ) : loading ? (
            <div className="rounded-[30px] border border-border bg-surface p-8 text-center shadow-[0_4px_24px_var(--shadow)]">
              <h2 className="text-3xl text-foreground">{t("search.fetchingMaterials")}</h2>
              <p className="mt-3 text-sm text-text-muted">{t("search.fetchingMaterialsDescription")}</p>
            </div>
          ) : materials.length === 0 ? (
            <div className="rounded-[30px] border border-border bg-surface p-8 text-center shadow-[0_4px_24px_var(--shadow)]">
              <h2 className="text-3xl text-foreground">{t("search.emptyTitle")}</h2>
              <p className="mt-3 text-sm text-text-muted">{t("search.emptyDescription")}</p>
            </div>
          ) : shouldGroupBySubject ? (
            <div className="space-y-8">
              {groupedMaterials.map(([subject, subjectMaterials]) => (
                <section key={subject} className="space-y-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.18em] text-text-soft">{t("search.subject")}</p>
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
