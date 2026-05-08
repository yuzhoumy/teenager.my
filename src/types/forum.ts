import type { Database } from "@/types/database";

export type ForumPost = Database["public"]["Tables"]["forum_posts"]["Row"];
export type ForumComment = Database["public"]["Tables"]["forum_comments"]["Row"];
