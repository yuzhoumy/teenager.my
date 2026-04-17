"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Brain,
  Gift,
  Handshake,
  Layers2,
  NotebookPen,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { usePreferences } from "@/components/preferences/preferences-provider";

export default function Home() {
  const { t } = usePreferences();

  const features = [
    { titleKey: "home.feature.studyResources", icon: BookOpen, active: true },
    { titleKey: "home.feature.studyRoom", icon: Layers2, active: false },
    { titleKey: "home.feature.studyBuddy", icon: Handshake, active: false },
    { titleKey: "home.feature.flashcards", icon: NotebookPen, active: false },
    { titleKey: "home.feature.quiz", icon: Brain, active: false },
    { titleKey: "home.feature.rewardsStreaks", icon: Gift, active: false },
  ] as const;

  const pillars = [
    {
      title: "Editorial calm",
      body: "A softer layout helps long reading sessions feel intentional, not noisy.",
    },
    {
      title: "Built for local exams",
      body: "The homepage now frames resources around real student workflows instead of generic feature blocks.",
    },
    {
      title: "Room to grow",
      body: "Upcoming modules are presented as part of a coherent roadmap, not disconnected placeholders.",
    },
  ];

  return (
    <section className="space-y-8 lg:space-y-12">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.8fr)]">
        <div className="paper-grid relative overflow-hidden rounded-[36px] border border-border bg-surface px-6 py-8 shadow-[0_16px_48px_var(--shadow)] sm:px-8 sm:py-10 lg:px-10 lg:py-12">
          <div className="absolute -right-12 top-8 h-36 w-36 rounded-full bg-[color:rgba(201,100,66,0.12)] blur-3xl" />
          <Badge className="mb-5">{t("home.phase1")}</Badge>
          <p className="mb-4 text-sm uppercase tracking-[0.18em] text-text-soft">
            Study resources, carefully arranged
          </p>
          <h1 className="text-balance max-w-3xl text-4xl text-foreground sm:text-5xl lg:text-[4rem]">
            {t("home.heroTitle")}
          </h1>
          <p className="mt-5 max-w-2xl text-base text-text-muted sm:text-lg">
            {t("home.heroDescription")}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/register">{t("home.getStarted")}</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/search">
                {t("home.browseResources")} <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <div className="mt-10 grid gap-4 border-t border-border pt-6 sm:grid-cols-3">
            <div>
              <p className="text-3xl text-foreground">01</p>
              <p className="mt-1 text-sm text-text-muted">Search papers and notes in one place.</p>
            </div>
            <div>
              <p className="text-3xl text-foreground">02</p>
              <p className="mt-1 text-sm text-text-muted">Keep the interface relaxed enough for daily study.</p>
            </div>
            <div>
              <p className="text-3xl text-foreground">03</p>
              <p className="mt-1 text-sm text-text-muted">Add new learning modes without crowding the experience.</p>
            </div>
          </div>
        </div>

        <Card className="flex h-full flex-col justify-between rounded-[36px] bg-[#141413] text-[#faf9f5]">
          <div>
            <div className="mb-5 inline-flex rounded-full border border-[#30302e] bg-[#1d1d1b] p-3 text-brand-soft">
              <Sparkles className="h-5 w-5" />
            </div>
            <p className="text-sm uppercase tracking-[0.18em] text-[#b0aea5]">Reading rhythm</p>
            <h2 className="mt-3 text-3xl text-[#faf9f5] sm:text-4xl">
              A calmer front page for students who stay with the work.
            </h2>
            <p className="mt-4 text-base text-[#b0aea5]">
              The new layout borrows from editorial design: warmer surfaces, stronger hierarchy, and clearer
              space between what is available now and what is coming next.
            </p>
          </div>
          <div className="mt-8 space-y-4 border-t border-[#30302e] pt-6">
            {pillars.map((pillar) => (
              <div key={pillar.title} className="rounded-[24px] border border-[#30302e] bg-[#1d1d1b] p-4">
                <h3 className="text-xl text-[#faf9f5]">{pillar.title}</h3>
                <p className="mt-2 text-sm text-[#b0aea5]">{pillar.body}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-[30px]">
          <p className="text-sm uppercase tracking-[0.16em] text-text-soft">Now open</p>
          <h2 className="mt-3 text-3xl text-foreground">{t("home.feature.studyResources")}</h2>
          <p className="mt-3 text-sm text-text-muted">{t("home.featureLiveDescription")}</p>
        </Card>
        <Card className="rounded-[30px]">
          <p className="text-sm uppercase tracking-[0.16em] text-text-soft">Designed next</p>
          <h2 className="mt-3 text-3xl text-foreground">{t("nav.studyRoom")}</h2>
          <p className="mt-3 text-sm text-text-muted">
            Quiet collaboration spaces, revision sessions, and a stronger sense of momentum.
          </p>
        </Card>
        <Card className="rounded-[30px]">
          <p className="text-sm uppercase tracking-[0.16em] text-text-soft">On the roadmap</p>
          <h2 className="mt-3 text-3xl text-foreground">{t("nav.studyBuddy")}</h2>
          <p className="mt-3 text-sm text-text-muted">
            Supportive tools for flashcards, quizzes, and rewards without turning the portal into a dashboard.
          </p>
        </Card>
      </div>

      <div>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-text-soft">{t("home.featureHighlights")}</p>
            <h2 className="mt-2 text-4xl text-foreground sm:text-5xl">A homepage shaped like chapters.</h2>
          </div>
          <Button asChild variant="secondary">
            <Link href="/search">Browse the library</Link>
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card
                key={feature.titleKey}
                className={
                  feature.active
                    ? "rounded-[30px] border-border-strong bg-surface-strong"
                    : "rounded-[30px] border-border bg-surface"
                }
              >
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                      feature.active ? "bg-[color:rgba(201,100,66,0.12)] text-brand" : "bg-surface-muted text-text-muted"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  {!feature.active ? <Badge>{t("nav.comingSoon")}</Badge> : null}
                </div>
                <h3 className="text-[1.7rem] text-foreground">{t(feature.titleKey)}</h3>
                <p className="mt-3 text-sm text-text-muted">
                  {feature.active ? t("home.featureLiveDescription") : t("home.featurePlannedDescription")}
                </p>
              </Card>
            );
          })}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <Card className="rounded-[36px] border-border bg-[#141413] text-[#faf9f5]">
          <p className="text-sm uppercase tracking-[0.18em] text-[#b0aea5]">Why this layout works</p>
          <h2 className="mt-3 text-4xl text-[#faf9f5] sm:text-5xl">Warm enough to feel human, clear enough to study.</h2>
          <p className="mt-4 text-base text-[#b0aea5]">
            Instead of a generic startup landing page, the new structure uses alternating light and dark sections,
            serif hierarchy, and softer containers to make the portal feel trustworthy.
          </p>
        </Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="rounded-[30px]">
            <h3 className="text-2xl text-foreground">Browse</h3>
            <p className="mt-3 text-sm text-text-muted">
              Start with papers, notes, and filters that reflect what students actually need first.
            </p>
          </Card>
          <Card className="rounded-[30px]">
            <h3 className="text-2xl text-foreground">Collect</h3>
            <p className="mt-3 text-sm text-text-muted">
              Bookmarks and uploads already have a visual place in the system, so the product can expand gracefully.
            </p>
          </Card>
          <Card className="rounded-[30px] sm:col-span-2">
            <h3 className="text-2xl text-foreground">Continue</h3>
            <p className="mt-3 text-sm text-text-muted">
              The remaining modules now read like the next chapters of one cohesive experience rather than unrelated future tabs.
            </p>
          </Card>
        </div>
      </div>
    </section>
  );
}
