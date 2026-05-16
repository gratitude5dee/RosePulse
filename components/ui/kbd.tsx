import * as React from "react";
import { cn } from "@/lib/utils";

function Kbd({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded border bg-secondary px-1.5 font-mono text-[11px] text-muted-foreground shadow-sm",
        className
      )}
      {...props}
    />
  );
}

export { Kbd };
