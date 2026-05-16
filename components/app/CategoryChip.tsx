"use client";

import { CATEGORY_META } from "@/lib/categories";
import type { TicketCategory, TicketPriority } from "@/lib/types";
import { cn } from "@/lib/utils";

export function CategoryChip({
  category,
  count,
  priorityPeak,
  active,
  onClick,
  disabled
}: {
  category: TicketCategory;
  count: number;
  priorityPeak?: TicketPriority;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const meta = CATEGORY_META[category];
  const Icon = meta.Icon;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "relative inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-all duration-200",
        count === 0 ? "border-border/70 bg-secondary/40 text-muted-foreground opacity-60" : "border-border bg-background/80 text-foreground shadow-sm hover:-translate-y-0.5",
        active && "ring-2 ring-ring ring-offset-2 ring-offset-background",
        disabled && "cursor-not-allowed"
      )}
    >
      <Icon className="size-3.5" style={{ color: `var(${meta.colorVar})` }} />
      <span className="max-w-20 truncate">{meta.label}</span>
      <span className="ml-0.5 rounded-full bg-secondary px-1.5 font-mono text-[11px]">{count}</span>
      {priorityPeak ? (
        <span
          aria-hidden
          className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border border-background"
          style={{ background: `var(--prio-${priorityPeak === "medium" ? "med" : priorityPeak})` }}
        />
      ) : null}
    </button>
  );
}
