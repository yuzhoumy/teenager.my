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
      <Button onClick={() => setOpen(true)}>{t("search.uploadMaterial")}</Button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
          <div className="w-full max-w-lg rounded-[32px] border border-border bg-background p-6 shadow-[0_24px_70px_rgba(0,0,0,0.24)]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.18em] text-text-soft">{t("search.placeholder")}</p>
                <h2 className="mt-2 text-2xl text-foreground">{t("search.uploadStudyMaterial")}</h2>
              </div>
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
              <Select required defaultValue="">
                <option value="" disabled>
                  {t("search.grade")}
                </option>
                <option value="f1">{t("auth.formPrefix", { form: 1 })}</option>
                <option value="f2">{t("auth.formPrefix", { form: 2 })}</option>
                <option value="f3">{t("auth.formPrefix", { form: 3 })}</option>
                <option value="f4">{t("auth.formPrefix", { form: 4 })}</option>
                <option value="f5">{t("auth.formPrefix", { form: 5 })}</option>
              </Select>
              <Input placeholder={t("upload.subjectPlaceholder")} required />
              <Input placeholder={t("search.origin")} required />
              <Input type="number" min={2000} max={2100} placeholder={t("resourceFilters.yearPlaceholder")} required />
              <Input placeholder={t("search.tagsCommaSeparated")} required />
              <Input type="file" required />
              <Textarea placeholder={t("upload.optionalNotes")} rows={3} />
              <Button type="button" className="w-full">
                {t("search.submitPlaceholder")}
              </Button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
