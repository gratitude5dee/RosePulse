"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PanelRightClose, PanelRightOpen, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Sidebar } from "@/components/app/Sidebar";
import { TopBar } from "@/components/app/TopBar";
import { GuestDetail } from "@/components/app/GuestDetail";
import { CinematicIntro } from "@/components/app/CinematicIntro";
import { CategoryOperationsDock } from "@/components/app/CategoryOperationsDock";
import { WalkieUiProvider, type WalkieOpenTarget } from "@/components/app/WalkieUiContext";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { useGuestCrm } from "@/lib/store/store-context";
import { cn } from "@/lib/utils";

const CommandPalette = dynamic(
  () => import("@/components/app/CommandPalette").then((mod) => mod.CommandPalette),
  { ssr: false }
);

const WalkiePanel = dynamic(() => import("@/components/app/WalkiePanel").then((mod) => mod.WalkiePanel), {
  ssr: false,
  loading: () => <div data-tier="frosted" className="h-full rounded-lg p-4 text-sm text-muted-foreground">Loading walkie...</div>
});

const NewTicketDialog = dynamic(
  () => import("@/components/app/NewTicketDialog").then((mod) => mod.NewTicketDialog),
  { ssr: false }
);

export function AppShell({ children }: { children: React.ReactNode }) {
  const { state, dispatch } = useGuestCrm();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(true);
  const [commandOpen, setCommandOpen] = useState(false);
  const [mobileWalkieOpen, setMobileWalkieOpen] = useState(false);
  const [walkieTarget, setWalkieTarget] = useState<WalkieOpenTarget | undefined>();

  useHotkeys({
    onCommandK: () => setCommandOpen(true),
    onEscape: () => {
      setCommandOpen(false);
      setMobileWalkieOpen(false);
    }
  });

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px) and (max-width: 1439px)");
    const sync = () => setRailCollapsed(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const openWalkie = useCallback((target?: WalkieOpenTarget) => {
    setWalkieTarget(target ? { ...target } : {});
    if (target?.guestId) {
      dispatch({ type: "SET_FOCUSED_GUEST", payload: { guestId: target.guestId } });
    }
    if (window.matchMedia("(min-width: 1024px)").matches) {
      setRailCollapsed(false);
      setMobileWalkieOpen(false);
    } else {
      setMobileWalkieOpen(true);
    }
  }, [dispatch]);

  const walkieUi = useMemo(
    () => ({
      target: walkieTarget,
      openWalkie,
      closeMobileWalkie: () => setMobileWalkieOpen(false),
      expandDesktopRail: () => setRailCollapsed(false)
    }),
    [openWalkie, walkieTarget]
  );

  return (
    <WalkieUiProvider value={walkieUi}>
      <div
        className={cn(
          "relative z-10 grid min-h-dvh grid-cols-1 transition-[grid-template-columns] duration-300 ease-out",
          sidebarCollapsed ? "md:grid-cols-[76px_minmax(0,1fr)]" : "md:grid-cols-[260px_minmax(0,1fr)]",
          sidebarCollapsed && railCollapsed && "lg:grid-cols-[76px_minmax(0,1fr)_64px]",
          sidebarCollapsed && !railCollapsed && "lg:grid-cols-[76px_minmax(0,1fr)_380px]",
          !sidebarCollapsed && railCollapsed && "lg:grid-cols-[260px_minmax(0,1fr)_64px]",
          !sidebarCollapsed && !railCollapsed && "lg:grid-cols-[260px_minmax(0,1fr)_380px]"
        )}
      >
      <div className="sticky top-0 hidden h-dvh border-r bg-background/64 pt-safe backdrop-blur-xl md:block">
        <Sidebar collapsed={sidebarCollapsed} onToggleCollapsed={() => setSidebarCollapsed((current) => !current)} />
      </div>

      <div className="min-w-0">
        <TopBar
          onMenu={() => setMobileNavOpen(true)}
          onSearch={() => setCommandOpen(true)}
        />
        <div className="sticky top-[calc(4rem+var(--safe-top))] z-20 flex items-center gap-2 border-b bg-background/78 px-safe py-2 backdrop-blur-xl md:hidden">
          <CategoryOperationsDock />
          <button
            type="button"
            onClick={() => openWalkie()}
            aria-label="Open walkie talkie"
            className="flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm"
          >
            <Radio className="size-4" />
            Walkie
          </button>
        </div>
        <main className="min-h-[calc(100dvh-4rem)] min-w-0 pb-[max(2rem,var(--safe-bottom))] md:pb-8">{children}</main>
      </div>

      <aside className="sticky top-0 hidden h-dvh border-l bg-background/40 p-2 pt-[max(var(--safe-top),0.75rem)] backdrop-blur-xl lg:block">
        {railCollapsed ? (
          <div className="flex h-full flex-col items-center justify-between py-3">
            <div className="flex flex-col items-center gap-4 pt-14">
              <button
                type="button"
                onClick={() => setRailCollapsed(false)}
                aria-label="Expand walkie rail"
                className="relative flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg transition-transform hover:-translate-y-0.5"
              >
                <Radio className="size-5" />
                <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border border-background bg-accent" />
              </button>
              <span className="rotate-90 whitespace-nowrap text-xs font-semibold tracking-[0.14em] text-muted-foreground">Walkie</span>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setRailCollapsed(false)} aria-label="Expand walkie rail">
              <PanelRightOpen className="size-4" />
            </Button>
          </div>
        ) : (
          <div className="h-full animate-in fade-in-0 slide-in-from-right-2 duration-300">
            <div className="mb-2 flex justify-end">
              <Button variant="ghost" size="icon" onClick={() => setRailCollapsed(true)} aria-label="Collapse walkie rail">
                <PanelRightClose className="size-4" />
              </Button>
            </div>
            <div className="h-[calc(100dvh-max(var(--safe-top),0.75rem)-3.5rem)]">
              <WalkiePanel variant="docked" />
            </div>
          </div>
        )}
      </aside>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-[min(300px,88vw)] p-0 pb-safe pt-safe">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
            <SheetDescription>Rosewood CRM navigation</SheetDescription>
          </SheetHeader>
          <Sidebar onNavigate={() => setMobileNavOpen(false)} />
        </SheetContent>
      </Sheet>

      <Sheet open={mobileWalkieOpen} onOpenChange={setMobileWalkieOpen}>
        <SheetContent side="bottom" className="h-[calc(100dvh-var(--safe-top)-0.75rem)] max-h-[860px] overflow-hidden rounded-t-xl p-3 pb-[max(var(--safe-bottom),0.75rem)]">
          <SheetHeader className="sr-only">
            <SheetTitle>Walkie-Talkie</SheetTitle>
            <SheetDescription>Push-to-talk guest filing panel</SheetDescription>
          </SheetHeader>
          <WalkiePanel variant="full" />
        </SheetContent>
      </Sheet>

      <Sheet open={Boolean(state.detailGuestId)} onOpenChange={(open) => !open && dispatch({ type: "CLOSE_GUEST_DETAIL" })}>
        <SheetContent side="right" className="w-full overflow-y-auto p-4 pb-[max(var(--safe-bottom),1rem)] pt-[max(var(--safe-top),1rem)] sm:max-w-[640px]">
          <SheetHeader className="sr-only">
            <SheetTitle>Guest detail</SheetTitle>
            <SheetDescription>Guest profile, tickets, preferences, and activity.</SheetDescription>
          </SheetHeader>
          {state.detailGuestId ? <GuestDetail guestId={state.detailGuestId} mode="drawer" /> : null}
        </SheetContent>
      </Sheet>

      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
      <NewTicketDialog />
      <CinematicIntro />
      </div>
    </WalkieUiProvider>
  );
}
