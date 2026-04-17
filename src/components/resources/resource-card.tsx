"use client";

import { Bookmark, Check, Download, GraduationCap, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { getMaterialGradeLabel, getMaterialTagLabel } from "@/lib/materials";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";
import type { StudyMaterial } from "@/types/resource";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { usePreferences } from "@/components/preferences/preferences-provider";

export function ResourceCard({ material }: { material: StudyMaterial }) {
  const { t } = usePreferences();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let active = true;

    async function syncBookmarkState() {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;

      if (!active) return;

      setIsLoggedIn(Boolean(user));

      if (!user) {
        setIsSaved(false);
        return;
      }

      const { data, error } = await supabase
        .from("material_bookmarks")
        .select("id")
        .eq("user_id", user.id)
        .eq("material_id", material.id)
        .maybeSingle();

      if (!active) return;

      if (!error) {
        setIsSaved(Boolean(data));
      }
    }

    void syncBookmarkState();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setIsLoggedIn(Boolean(session?.user));
      if (!session?.user) {
        setIsSaved(false);
      } else {
        void syncBookmarkState();
      }
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, [material.id]);

  async function toggleSave() {
    if (!isSupabaseConfigured || isSaving) return;

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) return;

    setIsSaving(true);

    if (isSaved) {
      const { error } = await supabase
        .from("material_bookmarks")
        .delete()
        .eq("user_id", user.id)
        .eq("material_id", material.id);

      if (!error) {
        setIsSaved(false);
      }
    } else {
      const bookmark: Database["public"]["Tables"]["material_bookmarks"]["Insert"] = {
        user_id: user.id,
        material_id: material.id,
      };

      const { error } = await supabase.from("material_bookmarks").insert(bookmark as never);

      if (!error) {
        setIsSaved(true);
      }
    }

    setIsSaving(false);
  }

  return (
    <Card className="rounded-[28px]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-2xl text-foreground">{material.title}</h3>
          <p className="mt-2 text-sm text-text-muted">{material.subject}</p>
        </div>
        <Badge>{material.year}</Badge>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {material.category_tags.map((tag) => (
          <Badge key={tag} className="bg-surface-muted">
            {getMaterialTagLabel(tag, t)}
          </Badge>
        ))}
      </div>

      <div className="mb-5 flex flex-wrap gap-4 text-sm text-text-muted">
        <span className="inline-flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-brand" />
          {getMaterialGradeLabel(material.grade, t)}
        </span>
        <span className="inline-flex items-center gap-2">
          <MapPin className="h-4 w-4 text-brand" />
          {material.origin}
        </span>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-xs text-text-soft">
          {t("search.downloadCount", { count: material.downloads })}
        </span>
        <div className="flex flex-wrap gap-2">
          {isLoggedIn ? (
            <Button size="sm" variant={isSaved ? "secondary" : "outline"} onClick={toggleSave} disabled={isSaving}>
              {isSaved ? <Check className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
              {isSaving ? t("search.saving") : isSaved ? t("search.saved") : t("search.save")}
            </Button>
          ) : null}
          <Button asChild size="sm">
            <a href={material.file_url}>
              <Download className="h-4 w-4" />
              {t("search.openFile")}
            </a>
          </Button>
        </div>
      </div>
    </Card>
  );
}
