"use client";

import type { PinnedFork, StudyMaterial } from "@/types/resource";
import { Card } from "@/components/ui/card";

export function ResourceSidebar({
  material,
  pinnedForks,
}: {
  material: StudyMaterial;
  pinnedForks: PinnedFork[];
}) {
  return (
    <div className="space-y-5">
      <Card className="rounded-[28px] border-border bg-white/80 p-5 shadow-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-text-soft">
              {material.core_type === "exercise" ? "Exercise Sidebar" : "Note Sidebar"}
            </p>
            <h3 className="mt-2 text-3xl text-foreground">Pinned forks</h3>
          </div>
        </div>

        <p className="mt-3 text-sm text-text-muted">
          Pinned forks are configured directly in the database and rendered below the main resource.
        </p>

        {pinnedForks.length > 0 ? (
          <div className="mt-4 space-y-3">
            {pinnedForks.map((fork, index) => (
              <a
                key={fork.id}
                href={`#pinned-fork-${fork.id}`}
                className="block rounded-2xl border border-border bg-surface px-4 py-3 transition hover:border-foreground"
              >
                <p className="text-sm font-semibold text-foreground">
                  {fork.pinned_title?.trim() || `Pinned fork ${index + 1}`}
                </p>
                <p className="mt-1 text-xs text-text-muted">By {fork.author_name}</p>
              </a>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-text-muted">No pinned forks are configured for this resource.</p>
        )}
      </Card>
    </div>
  );
}
