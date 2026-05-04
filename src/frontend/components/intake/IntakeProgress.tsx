import { Check, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

export type IntakeStage = "idle" | "scraping" | "extracting" | "mapping" | "error" | "complete";

const stages = [
  { id: "scraping", label: "Scraping" },
  { id: "extracting", label: "Extracting" },
  { id: "mapping", label: "Mapping" },
] as const;

export function IntakeProgress({ stage }: { stage: IntakeStage }) {
  const activeIndex = stages.findIndex((item) => item.id === stage);
  const complete = stage === "complete";

  return (
    <ol className="grid gap-2">
      {stages.map((item, index) => {
        const done = complete || (activeIndex > -1 && index < activeIndex);
        const active = item.id === stage;

        return (
          <li
            key={item.id}
            className={cn(
              "flex items-center gap-3 rounded-md border border-border/60 p-3 text-sm",
              active && "bg-muted/60 text-foreground",
            )}
          >
            <span className="flex size-6 items-center justify-center rounded-full bg-muted text-muted-foreground">
              {done ? (
                <Check className="size-3.5" />
              ) : active ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <span className="size-1.5 rounded-full bg-current" />
              )}
            </span>
            {item.label}
          </li>
        );
      })}
    </ol>
  );
}
