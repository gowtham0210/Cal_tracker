"use client";

import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Segmented, Sheet, Skeleton } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api";
import { downloadFile } from "@/lib/csv";
import { fromKey } from "@/lib/date";
import { usePlan } from "@/lib/plan-store";
import { weekDates } from "@/lib/week";

const weekday = (d: string, style: "short" | "long") => fromKey(d).toLocaleDateString(undefined, { weekday: style });

/** Export a day or the week as a PDF, with a live preview of exactly what will download. */
export function ExportSheet({ open, onClose, defaultDay }: { open: boolean; onClose: () => void; defaultDay: string }) {
  const weekStart = usePlan((s) => s.weekStart);
  const pending = usePlan((s) => s.pending);
  // What's planned, so any change to the plan makes a new preview.
  const contents = usePlan((s) => s.plan?.items.map((i) => `${i.id}:${i.food.id}:${i.quantity}:${i.date}:${i.meal}`).join(",") ?? "");
  const toast = useToast();
  const [scope, setScope] = useState<"week" | "day">("week");
  const [day, setDay] = useState(defaultDay);
  // "This day" follows the day being viewed.
  const [prevDefault, setPrevDefault] = useState(defaultDay);
  if (prevDefault !== defaultDay) {
    setPrevDefault(defaultDay);
    setDay(defaultDay);
  }
  const [macros, setMacros] = useState(false);
  const [preview, setPreview] = useState<{ key: string; url: string; filename: string; blob: Blob } | { key: string; error: string } | null>(null);

  const days = weekStart ? weekDates(weekStart) : [];
  const date = days.includes(day) ? day : days[0];
  // What the preview shows; it's refetched when this changes (and once saves have finished).
  const key = open && weekStart && pending === 0 ? `${weekStart}|${scope}|${date}|${macros}|${contents}` : null;

  useEffect(() => {
    if (!key || !weekStart) return;
    let live = true;
    const t = setTimeout(() => {
      api
        .exportPlanPdf(weekStart, { scope, date, macros })
        .then(({ filename, blob }) => live && setPreview({ key, url: URL.createObjectURL(blob), filename, blob }))
        .catch((e) => live && setPreview({ key, error: e instanceof ApiError ? e.problem.title : "Couldn't make the PDF." }));
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [key, weekStart, scope, date, macros]);
  // Each preview's URL is released once it's replaced or the sheet goes away.
  useEffect(() => () => void (preview && "url" in preview && URL.revokeObjectURL(preview.url)), [preview]);

  const current = preview?.key === key ? preview : null;
  const ready = current && "blob" in current ? current : null;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Export PDF"
      description="Printable in black and white, with each day's status in words."
      wide
      footer={
        <div className="flex justify-end">
          <Button
            disabled={!ready}
            onClick={() => {
              if (!ready) return;
              downloadFile(ready.filename, ready.blob);
              toast(`Downloaded ${ready.filename}`);
            }}
          >
            <Download className="size-4" /> Download PDF
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            label="What to export"
            value={scope}
            onChange={setScope}
            options={[
              { value: "day", label: "This day" },
              { value: "week", label: "Full week" },
            ]}
          />
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium">
            <input type="checkbox" className="size-4 accent-[var(--brand)]" checked={macros} onChange={(e) => setMacros(e.target.checked)} />
            Include macros
          </label>
        </div>
        {scope === "day" && (
          <Segmented
            label="Day"
            value={date}
            onChange={setDay}
            size="sm"
            className="w-full"
            options={days.map((d) => ({
              value: d,
              label: (
                <>
                  <span aria-hidden>{weekday(d, "short")}</span>
                  <span className="sr-only">{weekday(d, "long")}</span>
                </>
              ),
            }))}
          />
        )}
        <div className="overflow-hidden rounded-xl border border-border bg-surface-2" aria-live="polite" aria-busy={!current}>
          {!current ? (
            <Skeleton className={scope === "week" ? "aspect-[1.414] w-full" : "aspect-[0.707] mx-auto w-2/3"} />
          ) : "error" in current ? (
            <p role="alert" className="p-4 text-sm text-muted">
              {current.error}
            </p>
          ) : (
            <iframe title="PDF preview" src={`${current.url}#toolbar=0&view=FitH`} className={scope === "week" ? "aspect-[1.414] w-full" : "mx-auto aspect-[0.707] w-full max-w-md"} />
          )}
        </div>
      </div>
    </Sheet>
  );
}
