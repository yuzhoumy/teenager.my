export type MaterialGrade = "f1" | "f2" | "f3" | "f4" | "f5";
export type MaterialTag = "exercise" | "notes" | "past-year" | "trial-paper";

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
        Insert: {
          id?: string;
          title: string;
          file_url: string;
          grade: MaterialGrade;
          subject: string;
          category_tags: MaterialTag[];
          year: number;
          origin: string;
          uploaded_by?: string | null;
          created_at?: string;
          downloads?: number;
          metadata?: {
            grade?: MaterialGrade;
            subject?: string;
            category_tags?: MaterialTag[];
            year?: number;
            origin?: string;
          };
        };
        Update: Partial<Database["public"]["Tables"]["materials"]["Insert"]>;
      };
      pending_materials: {
        Row: {
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
        Insert: {
          id?: string;
          title: string;
          file_url: string;
          grade: MaterialGrade;
          subject: string;
          category_tags: MaterialTag[];
          year: number;
          origin: string;
          uploaded_by?: string | null;
          created_at?: string;
          downloads?: number;
          metadata?: {
            grade?: MaterialGrade;
            subject?: string;
            category_tags?: MaterialTag[];
            year?: number;
            origin?: string;
          };
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
    };
  };
};
