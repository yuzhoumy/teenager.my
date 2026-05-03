import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, GraduationCap, MapPin, Tag, UserRound } from "lucide-react";
import {
  getMaterialBySlug,
  getMaterialCoreTypeLabel,
  getMaterialGradeLabel,
  getMaterialSlugs,
  getMaterialTagLabel,
} from "@/lib/materials";
import { MarkdownRenderer } from "@/components/resources/markdown-renderer";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

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

  return (
    <section className="space-y-6">
      <Link
        href="/resources"
        className="inline-flex items-center gap-2 text-sm font-medium text-text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to resources
      </Link>

      <Card className="rounded-[32px]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-4xl">
            <p className="text-sm uppercase tracking-[0.18em] text-text-soft">Resource page</p>
            <h1 className="mt-3 text-4xl text-foreground sm:text-5xl">{material.title}</h1>
            <p className="mt-4 text-base text-text-muted">
              Read the markdown notes below. Any attachment or reference file now lives directly inside the content as a link.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-[#f3ebe4] text-brand">{getMaterialCoreTypeLabel(material.core_type)}</Badge>
            {material.category_tags.map((tag) => (
              <Badge key={tag}>{getMaterialTagLabel(tag)}</Badge>
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-3 border-t border-border pt-6 text-sm text-text-muted sm:grid-cols-2 xl:grid-cols-4">
          <span className="inline-flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-brand" />
            {getMaterialGradeLabel(material.grade)}
          </span>
          <span className="inline-flex items-center gap-2">
            <Tag className="h-4 w-4 text-brand" />
            {material.subject}
          </span>
          <span className="inline-flex items-center gap-2">
            <MapPin className="h-4 w-4 text-brand" />
            {material.origin}
          </span>
          <span className="inline-flex items-center gap-2">
            <UserRound className="h-4 w-4 text-brand" />
            {material.author_name}
          </span>
          <span className="inline-flex items-center gap-2 sm:col-span-2 xl:col-span-4">
            <CalendarDays className="h-4 w-4 text-brand" />
            Published for {material.year}
          </span>
        </div>
      </Card>

      <Card className="rounded-[32px]">
        <MarkdownRenderer markdown={material.content_markdown} />
      </Card>
    </section>
  );
}
