export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type MaterialGrade = "f1" | "f2" | "f3" | "f4" | "f5";
export type MaterialCoreType = "exercise" | "note";
export type MaterialTag = "past-year" | "trial-paper";
export type AnnotationRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          user_id: string;
          display_name: string;
          school: string;
          form: number;
          avatar_url: string | null;
          streak_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          display_name: string;
          school: string;
          form: number;
          avatar_url?: string | null;
          streak_count?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      materials: {
        Row: {
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
        Insert: {
          id?: string;
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
          uploaded_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["materials"]["Insert"]>;
      };
      pending_materials: {
        Row: {
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
        Insert: {
          id?: string;
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
          uploaded_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["pending_materials"]["Insert"]>;
      };
      material_bookmarks: {
        Row: {
          id: string;
          user_id: string;
          material_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          material_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["material_bookmarks"]["Insert"]>;
      };
        user_forks: {
          Row: {
            id: string;
            user_id: string;
            material_id: string;
          source_url: string;
          markdown_content: string;
          annotation_layers: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          material_id: string;
          source_url: string;
          markdown_content: string;
          annotation_layers?: Json | null;
          created_at?: string;
          };
          Update: Partial<Database["public"]["Tables"]["user_forks"]["Insert"]>;
        };
        fork_stars: {
          Row: {
            id: string;
            fork_id: string;
            user_id: string;
            created_at: string;
          };
          Insert: {
            id?: string;
            fork_id: string;
            user_id: string;
            created_at?: string;
          };
          Update: Partial<Database["public"]["Tables"]["fork_stars"]["Insert"]>;
        };
        annotations: {
        Row: {
          id: string;
          fork_id: string;
          page_number: number;
          bounding_rect: AnnotationRect;
          comment: string;
          quote: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          fork_id: string;
          page_number: number;
          bounding_rect: AnnotationRect;
          comment: string;
          quote?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["annotations"]["Insert"]>;
      };
      material_discussions: {
        Row: {
          id: string;
          material_id: string;
          user_id: string | null;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          material_id: string;
          user_id?: string | null;
          body: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["material_discussions"]["Insert"]>;
      };
    };
  };
};
