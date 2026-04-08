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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-background p-5 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t("upload.modalTitle")}</h2>
              <button
                type="button"
                className="rounded-md px-2 py-1 text-foreground/70 hover:bg-foreground/5"
                onClick={() => setOpen(false)}
              >
                {t("upload.close")}
              </button>
            </div>
            {/* TODO: Connect file upload with Supabase Storage and resources insert */}
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
