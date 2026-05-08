import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getMaterialBySlug, getMaterialSlugs } from "@/lib/materials";
import { UploadResourceWorkspace } from "@/components/resources/upload-resource-workspace";

type EditResourcePageProps = PageProps<"/resources/[slug]/edit">;

export async function generateStaticParams() {
  const materials = await getMaterialSlugs();

  return materials.map((material) => ({ slug: material.slug }));
}

export async function generateMetadata(props: EditResourcePageProps): Promise<Metadata> {
  const { slug } = await props.params;
  const material = await getMaterialBySlug(slug);

  if (!material) {
    return {
      title: "Resource not found | teenager.my",
    };
  }

  return {
    title: `Edit ${material.title} | teenager.my`,
    description: `Edit your uploaded resource: ${material.title}.`,
  };
}

export default async function EditResourcePage(props: EditResourcePageProps) {
  const { slug } = await props.params;
  const material = await getMaterialBySlug(slug);

  if (!material) {
    notFound();
  }

  if (!material.uploaded_by) {
    redirect(`/resources/${slug}`);
  }

  return <UploadResourceWorkspace mode="edit" initialMaterial={material} />;
}
