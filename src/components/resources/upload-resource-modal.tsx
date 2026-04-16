"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { usePreferences } from "@/components/preferences/preferences-provider";

export function UploadResourceModal() {
  const [open, setOpen] = useState(false);
  const { t } = usePreferences();

  return (
    <>
      <Button onClick={() => setOpen(true)}>{t("upload.uploadResourceButton")}</Button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
          <div className="w-full max-w-lg rounded-[32px] border border-border bg-background p-6 shadow-[0_24px_70px_rgba(0,0,0,0.24)]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl text-foreground">{t("upload.modalTitle")}</h2>
              <button
                type="button"
                className="rounded-xl px-3 py-2 text-text-muted hover:bg-surface-muted hover:text-foreground"
                onClick={() => setOpen(false)}
              >
                {t("upload.close")}
              </button>
            </div>
            <form className="space-y-3">
              <Input placeholder={t("upload.titlePlaceholder")} required />
              <Input placeholder={t("upload.subjectPlaceholder")} required />
              <Select required>
                <option value="">{t("upload.selectCategory")}</option>
                <option value="trial_paper">{t("upload.category.trial_paper")}</option>
                <option value="past_year_paper">{t("upload.category.past_year_paper")}</option>
                <option value="notes">{t("upload.category.notes")}</option>
              </Select>
              <Select required>
                <option value="">{t("upload.selectFormLevel")}</option>
                {[1, 2, 3, 4, 5].map((form) => (
                  <option key={form} value={form}>
                    {t("auth.formPrefix", { form })}
                  </option>
                ))}
              </Select>
              <Input type="number" min={2000} max={2100} placeholder={t("resourceFilters.yearPlaceholder")} required />
              <Input type="file" required />
              <Textarea placeholder={t("upload.optionalNotes")} rows={3} />
              <Button type="button" className="w-full">
                {t("upload.submitPhase1")}
              </Button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
