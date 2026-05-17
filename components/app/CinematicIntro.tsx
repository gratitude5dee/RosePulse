"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VISUAL_ASSETS } from "@/lib/visual-assets";
import { cn } from "@/lib/utils";

const INTRO_STORAGE_KEY = "rosepulse:intro:v1";

export function CinematicIntro() {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(media.matches);
    const syncMotion = () => setReducedMotion(media.matches);
    media.addEventListener("change", syncMotion);

    const dismissed = window.localStorage.getItem(INTRO_STORAGE_KEY);
    if (!dismissed) setVisible(true);

    return () => media.removeEventListener("change", syncMotion);
  }, []);

  function dismiss() {
    window.localStorage.setItem(INTRO_STORAGE_KEY, "dismissed");
    if (reducedMotion) {
      setVisible(false);
      return;
    }
    setExiting(true);
    window.setTimeout(() => setVisible(false), 420);
  }

  if (!visible) return null;

  const asset = VISUAL_ASSETS.introPool;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rosepulse-intro-title"
      className={cn(
        "fixed inset-0 z-[80] overflow-hidden bg-primary text-primary-foreground",
        exiting ? "animate-intro-fade-out" : reducedMotion ? "" : "animate-intro-fade-in"
      )}
    >
      <Image
        src={asset.src}
        alt={asset.alt}
        fill
        priority
        sizes="100vw"
        className={cn("object-cover object-center", reducedMotion ? "" : "animate-intro-ken-burns")}
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,oklch(0.13_0.012_60/0.82),oklch(0.18_0.015_60/0.42)_46%,oklch(0.18_0.015_60/0.10))]" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(0deg,oklch(0.13_0.012_60/0.72),transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_68%,oklch(0.78_0.09_78/0.16),transparent_32%)]" />

      <button
        type="button"
        onClick={dismiss}
        aria-label="Skip intro"
        className="absolute right-safe top-safe z-10 mr-4 mt-4 inline-flex min-h-10 min-w-10 items-center justify-center rounded-full border border-primary-foreground/18 bg-primary-foreground/10 text-primary-foreground backdrop-blur transition-colors hover:bg-primary-foreground/18"
      >
        <X className="size-4" />
      </button>

      <div className="relative z-10 flex min-h-dvh items-end px-safe pb-[max(var(--safe-bottom),1.5rem)] pt-safe">
        <div className="w-full max-w-3xl p-5 sm:p-8 lg:p-12">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary-foreground/72">Rosewood Sand Hill</p>
          <h1 id="rosepulse-intro-title" className="mt-3 font-serif text-5xl font-medium leading-[0.95] text-primary-foreground sm:text-7xl">
            RosePulse
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-primary-foreground/78 sm:text-lg">
            The property opens into service rhythm: arrivals, requests, memos, and the next detail before it is spoken.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button type="button" variant="secondary" onClick={dismiss} className="min-h-11 px-5">
              Enter operations
              <ArrowRight className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={dismiss}
              className="min-h-11 border border-primary-foreground/16 bg-primary-foreground/8 px-5 text-primary-foreground hover:bg-primary-foreground/14 hover:text-primary-foreground"
            >
              Skip
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
