"use client";

import Link from "next/link";
import { ArrowRight, MessageSquareText, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LivePulse } from "@/components/home/live-pulse";
import { cn } from "@/lib/utils";

export default function Home() {
  const pulseTeaserCards = [
    {
      href: "/resources",
      title: "SPM resources",
      body: "Notes, trial papers, and past-year papers for all SPM subjects, contributed by students and teachers across Malaysia.",
    },
    {
      href: "/forum",
      title: "Forum",
      body: "A place to discuss resources, ask questions, and share study tips. A community space that connects students and teachers beyond the resources themselves.",
    },
    {
      href: "/study-zone",
      title: "Study zone",
      body: "Online to offline study groups that you can join. Find a study group nearby or start your own and invite others to join you.",
    },
  ] as const;

  return (
    <section className="space-y-8 lg:space-y-12">
      {/* Full-bleed hero on large screens (breaks out of main max-width) */}
      <div className="lg:relative lg:left-1/2 lg:-translate-x-1/2 lg:w-screen lg:max-w-none">
        <div className="paper-grid relative overflow-hidden rounded-[36px] border border-border bg-surface px-6 py-8 shadow-[0_16px_48px_var(--shadow)] sm:px-8 sm:py-10 lg:rounded-none lg:border-x-0 lg:border-y lg:px-[max(1.5rem,calc((100vw-1200px)/2+2rem))] lg:py-14 xl:py-16 lg:shadow-[inset_0_-1px_0_var(--border)]">
          <div className="absolute -right-12 top-8 h-36 w-36 rounded-full bg-[color:rgba(201,100,66,0.12)] blur-3xl" />
          <p className="mb-4 text-sm uppercase tracking-[0.18em] text-text-soft">
            Stop studying alone. Join the collective brain.
          </p>
          <h1 className="text-balance max-w-3xl text-4xl text-foreground sm:text-5xl lg:text-[4rem] lg:max-w-[min(54rem,calc(100vw-8rem))]">
            A living SPM library. Improve them together.
          </h1>
          <p className="mt-5 max-w-2xl text-base text-text-muted sm:text-lg">
            teenager.my is a shared library for Malaysian students: notes, trial & past-year papers, and a fork workflow
            that lets you remix resources and share improvements back to the community.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/resources">
                Browse resources <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/register">Create an account</Link>
            </Button>
          </div>
          <div className="mt-10 grid gap-4 border-t border-border pt-6 sm:grid-cols-3">
            <div>
              <p className="text-3xl text-foreground">01</p>
              <p className="mt-1 text-sm text-text-muted">Explore a wide mix of notes, papers, and subjects.</p>
            </div>
            <div>
              <p className="text-3xl text-foreground">02</p>
              <p className="mt-1 text-sm text-text-muted">Fork resources to annotate, adapt, and keep your own version.</p>
            </div>
            <div>
              <p className="text-3xl text-foreground">03</p>
              <p className="mt-1 text-sm text-text-muted">Share back improvements through discussion and community forks.</p>
            </div>
          </div>
        </div>
      </div>

      <LivePulse />

      <div className="grid gap-4 lg:grid-cols-3">
        {pulseTeaserCards.map((item) => (
          <Link
            key={item.title}
            href={item.href}
            className={cn(
              "group relative block rounded-[30px] border border-border bg-surface p-6 shadow-[0_4px_24px_var(--shadow)] outline-none ring-offset-background transition duration-200",
              "hover:-translate-y-1 hover:border-brand/35 hover:bg-surface-strong hover:shadow-[0_14px_40px_var(--shadow)]",
              "focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2",
              "active:translate-y-0 active:brightness-[0.99]",
            )}
          >
            <span className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-background/70 text-brand transition-transform duration-200 group-hover:border-brand/30 group-hover:bg-[color:rgba(201,100,66,0.1)] md:right-6 md:top-6">
              <ArrowRight className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
            </span>
            <span className="block pr-14">
              <span className="mt-3 block text-3xl font-medium text-foreground transition-colors duration-200 group-hover:text-brand">
                {item.title}
              </span>
              <span className="mt-3 block text-sm text-text-muted">{item.body}</span>
            </span>
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand opacity-90 transition-opacity group-hover:opacity-100">
              Explore
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
            </span>
          </Link>
        ))}
      </div>

      <Card id="contact-us" className="scroll-mt-28 rounded-[36px] border-border bg-surface">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-start">
          <div>
            <Badge className="mb-4">Contact us</Badge>
            <h2 className="text-3xl text-foreground sm:text-4xl">Want to help, report an issue, or suggest a feature?</h2>
            <p className="mt-3 max-w-2xl text-sm text-text-muted sm:text-base">
              Message us anytime. We read feedback and use it to decide what to build next.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <Card className="rounded-[28px] border-border bg-background/50">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:rgba(201,100,66,0.12)] text-brand">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm uppercase tracking-[0.18em] text-text-soft">WhatsApp</p>
                  <a
                    className="mt-2 block text-base font-semibold text-foreground hover:underline"
                    href="https://wa.me/601128837042"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Chat on WhatsApp
                  </a>
                  <p className="mt-2 text-sm text-text-muted">Fast support and quick clarification.</p>
                </div>
              </div>
            </Card>
            <Card className="rounded-[28px] border-border bg-background/50">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:rgba(201,100,66,0.12)] text-brand">
                  <MessageSquareText className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm uppercase tracking-[0.18em] text-text-soft">Email</p>
                  <a className="mt-2 block text-base font-semibold text-foreground hover:underline" href="mailto:hello@teenager.my">
                    hello@teenager.my
                  </a>
                  <p className="mt-2 text-sm text-text-muted">For bugs, feedback, and content questions.</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </Card>
    </section>
  );
}
