"use client";

import { cn } from "@/lib/utils";

export function Waveform({ level, className }: { level: number; className?: string }) {
  return (
    <div className={cn("flex h-12 items-center justify-center gap-1", className)} aria-hidden>
      {Array.from({ length: 16 }, (_, index) => {
        const phase = Math.sin(index * 0.72) * 0.22 + 0.78;
        const height = Math.max(8, Math.round((level * 40 + 8) * phase));
        return (
          <span
            key={index}
            className="w-1 rounded-full bg-primary/80 transition-[height] duration-75"
            style={{ height }}
          />
        );
      })}
    </div>
  );
}
