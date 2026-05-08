import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getMaterialBySlug, getMaterialSlugs } from "@/lib/materials";
import { ResourceForkWorkspace } from "@/components/resources/resource-fork-workspace";

type ResourceForkPageProps = PageProps<"/resources/[slug]/fork">;

function extractFirstPdfLink(markdown: string) {
  const pattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  for (const match of markdown.matchAll(pattern)) {
    const href = match[2]?.trim() ?? "";
    if (/\.pdf($|[?#])/i.test(href)) {
      return href;
    }
  }
  return "";
}

export async function generateStaticParams() {
  const materials = await getMaterialSlugs();
  return materials.map((material) => ({ slug: material.slug }));
}

export async function generateMetadata(props: ResourceForkPageProps): Promise<Metadata> {
  const { slug } = await props.params;
  const material = await getMaterialBySlug(slug);

  if (!material) {
    return {
      title: "Resource not found | teenager.my",
    };
  }

  return {
    title: `Fork ${material.title} | teenager.my`,
    description: `Create and edit your fork for ${material.title}.`,
  };
}

export default async function ResourceForkPage(props: ResourceForkPageProps) {
  const { slug } = await props.params;
  const material = await getMaterialBySlug(slug);

  if (!material) {
    notFound();
  }

  return (
    <section className="space-y-6">
      <Link href={`/resources/${slug}`} className="inline-flex items-center gap-2 text-sm font-medium text-text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Back to resource
      </Link>
      <div className="relative left-1/2 w-screen -translate-x-1/2 sm:static sm:w-auto sm:translate-x-0">
        <Suspense fallback={<p className="px-4 text-sm text-text-muted sm:px-0">Loading fork editor...</p>}>
          <ResourceForkWorkspace
            materialId={material.id}
            materialSlug={material.slug}
            sourceUrl={extractFirstPdfLink(material.content_markdown)}
            initialMarkdown={material.content_markdown}
          />
        </Suspense>
      </div>
    </section>
  );
}
