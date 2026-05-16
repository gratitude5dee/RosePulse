import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PRIORITY_META } from "@/lib/categories";
import type { TicketPriority } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PriorityBadge({ priority, className }: { priority: TicketPriority; className?: string }) {
  const meta = PRIORITY_META[priority];
  return (
    <Badge
      variant="outline"
      className={cn("border-transparent bg-secondary/70 capitalize", className)}
      style={{ color: `var(${meta.colorVar})` }}
    >
      {priority === "urgent" ? <AlertTriangle className="size-3" /> : <span className="size-2 rounded-full" style={{ background: `var(${meta.colorVar})` }} />}
      {meta.label}
    </Badge>
  );
}
