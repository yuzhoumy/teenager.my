export type ResourceCategory = "trial_paper" | "past_year_paper" | "notes";

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
      resources: {
        Row: {
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
        Insert: {
          id?: string;
          title: string;
          subject: string;
          category: ResourceCategory;
          form_level: number;
          year: number;
          file_url: string;
          uploaded_by?: string | null;
          created_at?: string;
          downloads?: number;
        };
        Update: Partial<Database["public"]["Tables"]["resources"]["Insert"]>;
      };
      resource_bookmarks: {
        Row: {
          id: string;
          user_id: string;
          resource_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          resource_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["resource_bookmarks"]["Insert"]>;
      };
    };
  };
};
