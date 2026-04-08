"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, Brain, Gift, Handshake, Layers2, NotebookPen } from "lucide-react";
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

  return (
    <section className="space-y-8">
      <div className="rounded-3xl bg-gradient-to-r from-sky-600 via-indigo-600 to-teal-500 p-7 text-white shadow-md md:p-10">
        <Badge className="mb-4 bg-white/20 text-white">{t("home.phase1")}</Badge>
        <h1 className="max-w-2xl text-3xl font-bold tracking-tight md:text-4xl">
          {t("home.heroTitle")}
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-sky-100 md:text-base">
          {t("home.heroDescription")}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild variant="secondary">
            <Link href="/register">{t("home.getStarted")}</Link>
          </Button>
          <Button asChild variant="outline" className="border-white/40 bg-white/10 text-white hover:bg-white/20">
            <Link href="/resources">
              {t("home.browseResources")} <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-xl font-semibold">{t("home.featureHighlights")}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card
                key={feature.titleKey}
                className={feature.active ? "" : "bg-foreground/5 text-foreground/60"}
              >
                <div className="mb-3 flex items-center justify-between">
                  <Icon className="h-5 w-5 text-sky-600" />
                  {!feature.active ? (
                    <Badge className="bg-foreground/10 text-foreground/70">{t("nav.comingSoon")}</Badge>
                  ) : null}
                </div>
                <h3 className="font-semibold">{t(feature.titleKey)}</h3>
                <p className="mt-1 text-sm">
                  {feature.active ? t("home.featureLiveDescription") : t("home.featurePlannedDescription")}
                </p>
                {/* TODO: Connect feature cards to module routes when each module is implemented */}
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
