import type { Metadata } from "next";
import { UploadResourceWorkspace } from "@/components/resources/upload-resource-workspace";

export const metadata: Metadata = {
  title: "Upload resource | teenager.my",
  description: "Create and submit a study resource for review.",
};

export default function UploadResourcePage() {
  return <UploadResourceWorkspace />;
}
