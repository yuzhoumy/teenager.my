import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getMaterialBySlug,
  getMaterialCoreTypeLabel,
  getMaterialSlugs,
} from "@/lib/materials";
import { ResourceDetailClientShell } from "@/components/resources/resource-detail-client-shell";

type ResourcePageProps = PageProps<"/resources/[slug]">;

export async function generateStaticParams() {
  const materials = await getMaterialSlugs();
  return materials.map((material) => ({ slug: material.slug }));
}

export async function generateMetadata(props: ResourcePageProps): Promise<Metadata> {
  const { slug } = await props.params;
  const material = await getMaterialBySlug(slug);

  if (!material) {
    return {
      title: "Resource not found | teenager.my",
    };
  }

  return {
    title: `${material.title} | teenager.my`,
    description: `${material.subject} ${getMaterialCoreTypeLabel(material.core_type).toLowerCase()} by ${material.author_name}`,
  };
}

export default async function ResourceDetailPage(props: ResourcePageProps) {
  const { slug } = await props.params;
  const material = await getMaterialBySlug(slug);

  if (!material) {
    notFound();
  }

  return <ResourceDetailClientShell material={material} />;
}
