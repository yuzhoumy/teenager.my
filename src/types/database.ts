export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type MaterialGrade = "f1" | "f2" | "f3" | "f4" | "f5";
export type MaterialCoreType = "exercise" | "note";
export type MaterialTag = "exercise" | "note" | "textbook" | "trial-paper" | "past-year-paper" | "exam-paper";
export type ProfileForm = "y1" | "y2" | "y3" | "y4" | "y5" | "y6" | "f1" | "f2" | "f3" | "f4" | "f5" | "university" | "graduated";
export type AnnotationRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type NotificationType =
  | "follow"
  | "fork_material"
  | "comment_material"
  | "mention_material"
  | "comment_forum"
  | "reply_forum"
  | "mention_forum"
  | "new_material_followed"
  | "new_fork_followed"
  | "new_post_followed"
  | "announcement"
  | "fork_annotation";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          user_id: string;
          display_name: string;
          form: ProfileForm;
          avatar_url: string | null;
          streak_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          display_name: string;
          form: ProfileForm;
          avatar_url?: string | null;
          streak_count?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      profile_follows: {
        Row: {
          id: string;
          follower_id: string;
          followed_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          follower_id: string;
          followed_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profile_follows"]["Insert"]>;
      };
      profile_reports: {
        Row: {
          id: string;
          reported_user_id: string;
          reporter_id: string;
          reason: string;
          status: "open" | "reviewed" | "dismissed";
          created_at: string;
        };
        Insert: {
          id?: string;
          reported_user_id: string;
          reporter_id: string;
          reason: string;
          status?: "open" | "reviewed" | "dismissed";
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profile_reports"]["Insert"]>;
      };
      study_sessions: {
        Row: {
          id: string;
          user_id: string | null;
          title: string;
          description: string | null;
          subject: string | null;
          location_name: string;
          address: string | null;
          lat: number;
          lng: number;
          max_participants: number;
          starts_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          title?: string;
          description?: string | null;
          subject?: string | null;
          location_name: string;
          address?: string | null;
          lat: number;
          lng: number;
          max_participants?: number;
          starts_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["study_sessions"]["Insert"]>;
      };
      study_session_participants: {
        Row: {
          id: string;
          session_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["study_session_participants"]["Insert"]>;
      };
      study_session_comments: {
        Row: {
          id: string;
          session_id: string;
          user_id: string | null;
          author_name: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          user_id?: string | null;
          author_name: string;
          body: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["study_session_comments"]["Insert"]>;
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
          has_solution: boolean;
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
          has_solution?: boolean;
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
          has_solution: boolean;
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
          has_solution?: boolean;
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
      material_stars: {
        Row: {
          id: string;
          material_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          material_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["material_stars"]["Insert"]>;
      };
        user_forks: {
        Row: {
          id: string;
          user_id: string;
          material_id: string;
          source_url: string;
          description: string | null;
          markdown_content: string;
          annotation_layers: Json | null;
          is_pinned: boolean;
          pinned_title: string | null;
          pinned_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          material_id: string;
          source_url: string;
          description?: string | null;
          markdown_content: string;
          annotation_layers?: Json | null;
          is_pinned?: boolean;
          pinned_title?: string | null;
          pinned_order?: number;
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
      forum_posts: {
        Row: {
          id: string;
          user_id: string | null;
          author_name: string;
          title: string;
          tag: string;
          markdown: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          author_name: string;
          title: string;
          tag: string;
          markdown: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["forum_posts"]["Insert"]>;
      };
      forum_comments: {
        Row: {
          id: string;
          post_id: string;
          parent_comment_id: string | null;
          user_id: string | null;
          author_name: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          parent_comment_id?: string | null;
          user_id?: string | null;
          author_name: string;
          body: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["forum_comments"]["Insert"]>;
      };
      forum_post_loves: {
        Row: {
          id: string;
          post_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["forum_post_loves"]["Insert"]>;
      };
      notifications: {
        Row: {
          id: string;
          recipient_id: string;
          actor_id: string | null;
          type: NotificationType;
          payload: Json;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          recipient_id: string;
          actor_id?: string | null;
          type: NotificationType;
          payload?: Json;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          actor_id?: string | null;
          type?: NotificationType;
          payload?: Json;
          read_at?: string | null;
          created_at?: string;
        };
      };
      announcements: {
        Row: {
          id: string;
          title: string;
          body: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          body: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["announcements"]["Insert"]>;
      };
    };
  };
};
