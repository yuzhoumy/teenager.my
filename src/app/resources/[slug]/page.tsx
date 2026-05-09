import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  getMaterialBySlug,
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
    description: `${material.subject} resource by ${material.author_name}`,
  };
}

export default async function ResourceDetailPage(props: ResourcePageProps) {
  const { slug } = await props.params;

  const material = await getMaterialBySlug(slug);

  if (!material) {
    notFound();
  }

  return (
    <Suspense fallback={<p className="text-sm text-text-muted">Loading resource…</p>}>
      <ResourceDetailClientShell material={material} />
    </Suspense>
  );
}
