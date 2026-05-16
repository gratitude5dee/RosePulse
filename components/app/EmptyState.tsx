import type { LucideIcon } from "lucide-react";
import Image from "next/image";
import type { VisualAsset } from "@/lib/visual-assets";
import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  body,
  icon: Icon,
  image,
  action,
  className
}: {
  title: string;
  body: string;
  icon?: LucideIcon;
  image?: VisualAsset;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-dashed bg-background/55 p-8 text-center", className)}>
      {image ? (
        <div className="relative mx-auto mb-5 h-32 w-full max-w-md overflow-hidden rounded-lg border bg-secondary shadow-sm">
          <Image src={image.src} alt={image.alt} fill sizes="(min-width: 768px) 448px, 100vw" className="object-cover" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_48%,oklch(0.18_0.015_60/0.18))]" />
        </div>
      ) : Icon ? (
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
