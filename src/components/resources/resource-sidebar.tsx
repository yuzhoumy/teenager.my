"use client";

import type { PinnedFork } from "@/types/resource";
import { Card } from "@/components/ui/card";

export function ResourceSidebar({
  pinnedForks,
}: {
  pinnedForks: PinnedFork[];
}) {
  return (
    <div className="space-y-5">
      <Card className="rounded-[20px] border-border bg-surface/70 p-4 shadow-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="mt-2 text-xl text-foreground">Pinned forks</h3>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-text-muted">
          Pinned forks are configured directly in the database and rendered below the main resource.
        </p>

        {pinnedForks.length > 0 ? (
          <div className="mt-4 space-y-2">
            {pinnedForks.map((fork, index) => (
              <a
                key={fork.id}
                href={`#pinned-fork-${fork.id}`}
                className="block rounded-2xl border border-border bg-background/45 px-3 py-2.5 transition hover:border-border-strong hover:bg-surface"
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
