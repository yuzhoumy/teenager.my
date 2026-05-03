import type { MaterialCoreType, MaterialGrade, MaterialTag } from "@/types/database";

export type StudyMaterial = {
  id: string;
  slug: string;
  title: string;
  core_type: MaterialCoreType;
  content_markdown: string;
  grade: MaterialGrade;
  subject: string;
  category_tags: MaterialTag[];
  year: number;
  origin: string;
  author_name: string;
  uploaded_by: string | null;
  created_at: string;
};
