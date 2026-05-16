import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  body,
  icon: Icon,
  action,
  className
}: {
  title: string;
  body: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-dashed bg-background/55 p-8 text-center", className)}>
      {Icon ? (
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-accent/20 text-primary">
          <Icon className="size-5" />
        </div>
      ) : null}
      <h3 className="display-3">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
