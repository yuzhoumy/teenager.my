import type { ResourceCategory } from "@/types/database";

export type StudyResource = {
  id: string;
  title: string;
  subject: string;
  category: ResourceCategory;
  form_level: number;
  year: number;
  file_url: string;
  uploaded_by: string | null;
  created_at: string;
  downloads: number;
};
