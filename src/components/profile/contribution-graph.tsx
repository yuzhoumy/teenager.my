import Link from "next/link";
import { ChevronLeft, ChevronRight, GitFork, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildContributionWeeks,
  getContributionActivityByDate,
  getContributionTotal,
  type ContributionActivity,
} from "@/lib/profile-contributions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type ContributionGraphProps = {
  activity: ContributionActivity[];
  className?: string;
};

const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEK_COLUMN_WIDTH_PX = 18;
const WEEKDAY_COLUMN_WIDTH_PX = 26;
const NAV_BUTTON_WITH_GAP_PX = 40;
const weekdayLabels: Record<number, string> = {
  1: "Mon",
  3: "Wed",
  5: "Fri",
};

const levelClassName: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: "bg-foreground/10",
  1: "bg-emerald-500/30",
  2: "bg-emerald-500/50",
  3: "bg-emerald-500/70",
  4: "bg-emerald-500/90",
};

export function ContributionGraph({ activity, className }: ContributionGraphProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [weeksPerPage, setWeeksPerPage] = useState(53);
  const weeks = useMemo(() => buildContributionWeeks(activity), [activity]);
  const total = useMemo(
    () => getContributionTotal(activity.map((item) => item.createdAt)),
    [activity],
  );
  const activityByDate = useMemo(() => getContributionActivityByDate(activity), [activity]);
  const [pageStartIndex, setPageStartIndex] = useState(Math.max(0, weeks.length - weeksPerPage));
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    function resolveWeeksForWidth(width: number) {
      // Reserve space for arrows, weekday labels, and content paddings/gaps.
      const availableGraphWidth =
        width - NAV_BUTTON_WITH_GAP_PX * 2 - WEEKDAY_COLUMN_WIDTH_PX - 8;

      const fitWeeks = Math.floor(availableGraphWidth / WEEK_COLUMN_WIDTH_PX);
      return Math.max(8, Math.min(53, fitWeeks));
    }

    function updateLayout() {
      const width = containerRef.current?.clientWidth ?? window.innerWidth;
      setWeeksPerPage(resolveWeeksForWidth(width));
    }

    updateLayout();
    const observer = new ResizeObserver(updateLayout);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    window.addEventListener("resize", updateLayout);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateLayout);
    };
  }, []);

  useEffect(() => {
    setPageStartIndex(Math.max(0, weeks.length - weeksPerPage));
  }, [weeks.length, weeksPerPage]);

  const pageEndIndex = Math.min(weeks.length, pageStartIndex + weeksPerPage);
  const visibleWeeks = weeks.slice(pageStartIndex, pageEndIndex);
  const canGoLeft = pageStartIndex > 0;
  const canGoRight = pageEndIndex < weeks.length;

  const monthMarkers = visibleWeeks
    .map((week, index) => {
      const date = new Date(`${week.weekStartKey}T00:00:00.000Z`);
      return { index, month: date.getUTCMonth(), day: date.getUTCDate() };
    })
    .filter((marker, index, markers) => marker.day <= 7 && (index === 0 || markers[index - 1]?.month !== marker.month));
  const selectedActivity = selectedDateKey ? (activityByDate.get(selectedDateKey) ?? []) : [];

  return (
    <div ref={containerRef} className={cn("space-y-3", className)}>
      <p className="text-sm text-foreground/70">{total} contributions in the last year</p>
      <div className="flex items-start gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 w-8 p-0"
          onClick={() => setPageStartIndex((current) => Math.max(0, current - weeksPerPage))}
          disabled={!canGoLeft}
          aria-label="Show older contributions"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="inline-flex min-w-0 flex-1 gap-2 overflow-hidden">
          <div className="grid shrink-0 grid-rows-7 gap-1 pt-5 text-[11px] text-foreground/60">
            {Array.from({ length: 7 }, (_, day) => (
              <span key={`weekday-${day}`} className="h-3.5 leading-3.5">
                {weekdayLabels[day] ?? ""}
              </span>
            ))}
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <div className="relative h-4 text-[11px] text-foreground/60">
              {monthMarkers.map((marker) => (
                <span
                  key={`${marker.index}-${marker.month}`}
                  className="absolute top-0"
                  style={{ left: `${marker.index * WEEK_COLUMN_WIDTH_PX}px` }}
                >
                  {monthLabels[marker.month]}
                </span>
              ))}
            </div>
            <div className="grid w-fit grid-flow-col grid-rows-7 gap-1">
              {visibleWeeks.map((week) =>
                week.cells.map((cell) => (
                  <button
                    key={cell.dateKey}
                    type="button"
                    className={cn(
                      "h-3.5 w-3.5 rounded-[3px] border border-foreground/10 transition",
                      cell.isFuture ? "opacity-40" : levelClassName[cell.level],
                      selectedDateKey === cell.dateKey ? "ring-1 ring-foreground/60" : "",
                      !cell.isFuture ? "hover:brightness-110" : "cursor-default",
                    )}
                    title={`${cell.count} contribution${cell.count === 1 ? "" : "s"} on ${new Date(`${cell.dateKey}T00:00:00.000Z`).toLocaleDateString()}`}
                    onClick={() => {
                      if (cell.isFuture || cell.count === 0) {
                        setSelectedDateKey(cell.dateKey);
                        return;
                      }
                      setSelectedDateKey(cell.dateKey);
                    }}
                  />
                )),
              )}
            </div>
          </div>
        </div>

        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 w-8 p-0"
          onClick={() => setPageStartIndex((current) => Math.min(Math.max(0, weeks.length - weeksPerPage), current + weeksPerPage))}
          disabled={!canGoRight}
          aria-label="Show newer contributions"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {selectedDateKey ? (
        <div className="rounded-xl border border-foreground/10 bg-foreground/5 p-3">
          <p className="text-sm font-medium text-foreground">
            {new Date(`${selectedDateKey}T00:00:00.000Z`).toLocaleDateString()}
          </p>
          {selectedActivity.length > 0 ? (
            <ul className="mt-2 space-y-2 text-sm">
              {selectedActivity.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-foreground/80">
                    {item.type === "upload" ? <Upload className="h-3.5 w-3.5" /> : <GitFork className="h-3.5 w-3.5" />}
                    <span>{item.type === "upload" ? "Uploaded resource" : "Forked resource"}: {item.title}</span>
                  </div>
                  <Link href={item.href} className="text-sky-600 hover:text-sky-500">
                    View
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-foreground/70">No contributions on this day.</p>
          )}
        </div>
      ) : (
        <p className="text-xs text-foreground/60">Click a block to view contributions for that date.</p>
      )}
    </div>
  );
}
