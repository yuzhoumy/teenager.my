import { Suspense } from "react";
import { ResourcesPageClient } from "@/components/resources/resources-page-client";

function SearchPageFallback() {
  return (
    <section className="space-y-6">
      <div className="rounded-[30px] border border-border bg-surface p-8 shadow-[0_4px_24px_var(--shadow)]">
        <p className="text-sm uppercase tracking-[0.18em] text-text-soft">Metadata search</p>
        <h1 className="mt-2 text-4xl text-foreground sm:text-5xl">Study materials</h1>
        <p className="mt-3 text-base text-text-muted">Preparing faceted search...</p>
      </div>
    </section>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchPageFallback />}>
      <ResourcesPageClient />
    </Suspense>
  );
}
