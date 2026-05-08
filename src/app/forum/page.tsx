import { Suspense } from "react";
import { ForumPageClient } from "@/components/forum/forum-page-client";

function ForumFallback() {
  return (
    <section className="space-y-6">
      <div className="rounded-[30px] border border-border bg-surface p-8 shadow-[0_4px_24px_var(--shadow)]">
        <p className="text-sm uppercase tracking-[0.18em] text-text-soft">Student forum</p>
        <h1 className="mt-2 text-4xl text-foreground sm:text-5xl">Forum</h1>
        <p className="mt-3 text-base text-text-muted">Loading posts...</p>
      </div>
    </section>
  );
}

export default function ForumPage() {
  return (
    <Suspense fallback={<ForumFallback />}>
      <ForumPageClient />
    </Suspense>
  );
}
