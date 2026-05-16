import { STATUS_ICONS, STATUS_LABELS } from "@/lib/categories";
import type { TicketStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function StatusPill({ status, className }: { status: TicketStatus; className?: string }) {
  const Icon = STATUS_ICONS[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        status === "resolved" && "border-[var(--success)]/30 bg-[var(--success)]/10 text-[var(--success)]",
        status === "blocked" && "border-[var(--warning)]/30 bg-[var(--warning)]/10 text-[var(--warning)]",
        status === "escalated" &&
          "border-destructive/30 bg-gradient-to-r from-destructive/15 to-[var(--prio-urgent)]/15 text-destructive",
        status === "open" && "border-border bg-secondary/70 text-muted-foreground",
        status === "in_progress" && "border-primary/20 bg-primary/10 text-primary",
        className
      )}
    >
      <Icon className="size-3" />
      {STATUS_LABELS[status]}
    </span>
  );
}
