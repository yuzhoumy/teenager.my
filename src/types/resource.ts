import type { MaterialGrade, MaterialTag } from "@/types/database";

export type StudyMaterial = {
  id: string;
  title: string;
  file_url: string;
  grade: MaterialGrade;
  subject: string;
  category_tags: MaterialTag[];
  year: number;
  origin: string;
  uploaded_by: string | null;
  created_at: string;
  downloads: number;
  metadata: {
    grade?: MaterialGrade;
    subject?: string;
    category_tags?: MaterialTag[];
    year?: number;
    origin?: string;
  };
};
