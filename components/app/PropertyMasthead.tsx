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
    <section className={cn("relative mb-5 overflow-hidden rounded-lg border bg-primary text-primary-foreground shadow-sm sm:mb-6", className)}>
      <div className="relative h-28 sm:h-48 lg:h-56">
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
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary-foreground/72 sm:text-xs">{eyebrow}</p>
            <h2 className="mt-1 font-serif text-2xl font-medium leading-7 text-primary-foreground sm:text-[1.75rem] sm:leading-[2.125rem]">{title}</h2>
            <p className="mt-1 hidden max-w-md text-sm leading-6 text-primary-foreground/78 min-[390px]:block min-[390px]:line-clamp-1 sm:mt-2 sm:line-clamp-none">
              {body}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
