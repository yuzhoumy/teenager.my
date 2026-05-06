import type {
  AnnotationRect,
  MaterialCoreType,
  MaterialGrade,
  MaterialTag,
} from "@/types/database";

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

export type ResourcePdfLink = {
  href: string;
  label: string;
};

export type UserFork = {
  id: string;
  user_id: string;
  material_id: string;
  source_url: string;
  markdown_content: string;
  annotation_layers: Record<number, unknown[]> | null;
  is_pinned: boolean;
  pinned_title: string | null;
  pinned_order: number;
  created_at: string;
};

export type ForkStar = {
  id: string;
  fork_id: string;
  user_id: string;
  created_at: string;
};

export type ForkCardData = {
  id: string;
  user_id: string;
  material_id: string;
  source_url: string;
  markdown_content: string;
  annotation_layers: Record<number, unknown[]> | null;
  is_pinned: boolean;
  pinned_title: string | null;
  pinned_order: number;
  created_at: string;
  author_name: string;
  star_count: number;
  has_starred: boolean;
};

export type PinnedFork = UserFork & {
  author_name: string;
};

export type ForkAnnotation = {
  id: string;
  fork_id: string;
  page_number: number;
  bounding_rect: AnnotationRect;
  comment: string;
  quote: string | null;
  created_by: string | null;
  created_at: string;
};

export type DiscussionPost = {
  id: string;
  material_id: string;
  user_id: string | null;
  body: string;
  created_at: string;
  author_name?: string;
};
