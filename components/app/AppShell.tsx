"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Sidebar } from "@/components/app/Sidebar";
import { TopBar } from "@/components/app/TopBar";
import { GuestDetail } from "@/components/app/GuestDetail";
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
  const [railCollapsed, setRailCollapsed] = useState(true);
  const [commandOpen, setCommandOpen] = useState(false);
  const [mobileWalkieOpen, setMobileWalkieOpen] = useState(false);

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

  return (
    <div
      className={cn(
        "relative z-10 min-h-dvh",
        "grid grid-cols-1 md:grid-cols-[260px_minmax(0,1fr)]",
        railCollapsed ? "lg:grid-cols-[260px_minmax(0,1fr)_64px]" : "lg:grid-cols-[260px_minmax(0,1fr)_380px]"
      )}
    >
      <div className="sticky top-0 hidden h-dvh border-r bg-background/64 backdrop-blur-xl md:block">
        <Sidebar />
      </div>

      <div className="min-w-0">
        <TopBar
          onMenu={() => setMobileNavOpen(true)}
          onSearch={() => setCommandOpen(true)}
          railCollapsed={railCollapsed}
          onToggleRail={() => setRailCollapsed((current) => !current)}
        />
        <main className="min-h-[calc(100dvh-4rem)] min-w-0 pb-24 lg:pb-6">{children}</main>
      </div>

      <aside className="sticky top-0 hidden h-dvh border-l bg-background/40 p-3 backdrop-blur-xl lg:block">
        {railCollapsed ? (
          <div className="flex h-full flex-col items-center gap-3 pt-16">
            <Button variant="accent" size="icon" onClick={() => setRailCollapsed(false)} aria-label="Expand walkie rail">
              <Radio className="size-5" />
            </Button>
            <span className="rotate-90 whitespace-nowrap text-xs font-medium text-muted-foreground">Walkie</span>
          </div>
        ) : (
          <WalkiePanel variant="docked" />
        )}
      </aside>

      <button
        type="button"
        onClick={() => setMobileWalkieOpen(true)}
        className="fixed bottom-4 left-1/2 z-40 flex h-12 -translate-x-1/2 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground shadow-xl lg:hidden"
      >
        <Radio className="size-4" />
        Hold to talk
      </button>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-[300px] p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
            <SheetDescription>Rosewood CRM navigation</SheetDescription>
          </SheetHeader>
          <Sidebar onNavigate={() => setMobileNavOpen(false)} />
        </SheetContent>
      </Sheet>

      <Sheet open={mobileWalkieOpen} onOpenChange={setMobileWalkieOpen}>
        <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto p-3">
          <SheetHeader className="sr-only">
            <SheetTitle>Walkie-Talkie</SheetTitle>
            <SheetDescription>Push-to-talk guest filing panel</SheetDescription>
          </SheetHeader>
          <WalkiePanel variant="full" />
        </SheetContent>
      </Sheet>

      <Sheet open={Boolean(state.detailGuestId)} onOpenChange={(open) => !open && dispatch({ type: "CLOSE_GUEST_DETAIL" })}>
        <SheetContent side="right" className="w-full overflow-y-auto p-4 sm:max-w-[640px]">
          <SheetHeader className="sr-only">
            <SheetTitle>Guest detail</SheetTitle>
            <SheetDescription>Guest profile, tickets, preferences, and activity.</SheetDescription>
          </SheetHeader>
          {state.detailGuestId ? <GuestDetail guestId={state.detailGuestId} mode="drawer" /> : null}
        </SheetContent>
      </Sheet>

      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
      <NewTicketDialog />
    </div>
  );
}
