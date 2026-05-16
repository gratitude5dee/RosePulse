import Image from "next/image";
import type { VisualAsset } from "@/lib/visual-assets";
import { cn } from "@/lib/utils";

export function PropertyMasthead({
  asset,
  eyebrow,
  title,
  body,
  priority = false,
  className
}: {
  asset: VisualAsset;
  eyebrow: string;
  title: string;
  body: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <section className={cn("relative mb-6 overflow-hidden rounded-lg border bg-primary text-primary-foreground shadow-sm", className)}>
      <div className="relative h-40 sm:h-48 lg:h-56">
        <Image
          src={asset.src}
          alt={asset.alt}
          fill
          priority={priority}
          sizes="(min-width: 1440px) calc(100vw - 680px), (min-width: 1024px) calc(100vw - 324px), 100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,oklch(0.18_0.015_60/0.78),oklch(0.18_0.015_60/0.34)_48%,oklch(0.18_0.015_60/0.08))]" />
        <div className="absolute inset-0 flex items-end p-4 sm:p-6">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-foreground/72">{eyebrow}</p>
            <h2 className="display-2 mt-1 text-primary-foreground">{title}</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-primary-foreground/78">{body}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
