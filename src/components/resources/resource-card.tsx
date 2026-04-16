"use client";

import { Bookmark, Download } from "lucide-react";
import type { StudyResource } from "@/types/resource";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { usePreferences } from "@/components/preferences/preferences-provider";

export function ResourceCard({ resource }: { resource: StudyResource }) {
  const { t } = usePreferences();

  const categoryLabel: Record<StudyResource["category"], string> = {
    notes: t("resourceFilters.category.notes"),
    past_year_paper: t("resourceFilters.category.past_year_paper"),
    trial_paper: t("resourceFilters.category.trial_paper"),
  };

  return (
    <Card className="rounded-[28px]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-2xl text-foreground">{resource.title}</h3>
          <p className="mt-2 text-sm text-text-muted">
            {resource.subject} • {t("resourceCard.formLine", { form: resource.form_level })}
          </p>
        </div>
        <Badge>{categoryLabel[resource.category]}</Badge>
      </div>
      <div className="mb-5 flex items-center gap-3 text-xs text-text-soft">
        <span>{t("resourceCard.year", { year: resource.year })}</span>
        <span className="inline-flex items-center gap-1">
          <Download className="h-3.5 w-3.5" /> {resource.downloads}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button asChild size="sm">
          <a href={resource.file_url}>{t("resourceCard.download")}</a>
        </Button>
        <Button size="sm" variant="outline">
          <Bookmark className="h-4 w-4" />
          {t("resourceCard.bookmark")}
        </Button>
      </div>
    </Card>
  );
}
