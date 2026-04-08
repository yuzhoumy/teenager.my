"use client";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { usePreferences } from "@/components/preferences/preferences-provider";

export type ResourceFilters = {
  search: string;
  subject: string;
  formLevel: string;
  category: string;
  year: string;
  sortBy: "latest" | "downloads";
};

type Props = {
  filters: ResourceFilters;
  onChange: (next: ResourceFilters) => void;
};

export function ResourceFiltersBar({ filters, onChange }: Props) {
  const { t } = usePreferences();
  return (
    <div className="grid gap-3 rounded-2xl border bg-background p-4 md:grid-cols-6">
      <Input
        className="md:col-span-2"
        placeholder={t("resourceFilters.searchPlaceholder")}
        value={filters.search}
        onChange={(e) => onChange({ ...filters, search: e.target.value })}
      />
      <Input
        placeholder={t("resourceFilters.subjectPlaceholder")}
        value={filters.subject}
        onChange={(e) => onChange({ ...filters, subject: e.target.value })}
      />
      <Select value={filters.formLevel} onChange={(e) => onChange({ ...filters, formLevel: e.target.value })}>
        <option value="">{t("resourceFilters.allForms")}</option>
        {[1, 2, 3, 4, 5].map((form) => (
          <option key={form} value={form}>
            {t("resourceFilters.formOption", { form })}
          </option>
        ))}
      </Select>
      <Select value={filters.category} onChange={(e) => onChange({ ...filters, category: e.target.value })}>
        <option value="">{t("resourceFilters.allCategories")}</option>
        <option value="trial_paper">{t("resourceFilters.category.trial_paper")}</option>
        <option value="past_year_paper">{t("resourceFilters.category.past_year_paper")}</option>
        <option value="notes">{t("resourceFilters.category.notes")}</option>
      </Select>
      <Input
        placeholder={t("resourceFilters.yearPlaceholder")}
        value={filters.year}
        onChange={(e) => onChange({ ...filters, year: e.target.value })}
      />
      <Select value={filters.sortBy} onChange={(e) => onChange({ ...filters, sortBy: e.target.value as ResourceFilters["sortBy"] })}>
        <option value="latest">{t("resourceFilters.latest")}</option>
        <option value="downloads">{t("resourceFilters.mostDownloaded")}</option>
      </Select>
    </div>
  );
}
