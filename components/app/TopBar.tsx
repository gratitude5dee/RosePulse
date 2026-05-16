"use client";

import { Bell, Menu, PanelRightClose, PanelRightOpen, Search, UserRound } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { KbdHint } from "@/components/app/KbdHint";
import { ThemeToggle } from "@/components/app/ThemeToggle";
import { useGuestCrm } from "@/lib/store/store-context";

export function TopBar({
  onMenu,
  onSearch,
  onToggleRail,
  railCollapsed
}: {
  onMenu: () => void;
  onSearch: () => void;
  onToggleRail: () => void;
  railCollapsed: boolean;
}) {
  const { state } = useGuestCrm();
  const syncLabel = state.backend.mode === "supabase" ? (state.backend.status === "synced" ? "Live" : "Syncing") : "Fixture";

  return (
    <header className="sticky top-0 z-30 flex min-h-[calc(4rem+var(--safe-top))] items-center gap-2 border-b bg-background/78 px-safe pt-safe backdrop-blur-xl sm:gap-3">
      <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenu} aria-label="Open navigation">
        <Menu className="size-5" />
      </Button>
      <div className="min-w-0 max-w-[9rem] sm:max-w-none">
        <p className="truncate text-sm font-semibold">Rosewood Manor</p>
        <p className="hidden text-xs text-muted-foreground sm:block">Frontline operations</p>
      </div>
      <div className="hidden rounded-full border bg-secondary/60 px-3 py-1 text-xs text-muted-foreground sm:block">
        {format(new Date(), "EEEE, MMM d")}
      </div>
      <Badge
        variant={state.backend.status === "error" ? "destructive" : state.backend.mode === "supabase" ? "champagne" : "secondary"}
        className="hidden shrink-0 sm:inline-flex"
        title={state.backend.message}
      >
        {syncLabel}
      </Badge>
      <button
        type="button"
        onClick={onSearch}
        className="ml-auto hidden h-10 min-w-[260px] items-center justify-between rounded-full border bg-background/72 px-3 text-sm text-muted-foreground shadow-sm transition-colors hover:bg-secondary/60 md:flex"
      >
        <span className="flex items-center gap-2">
          <Search className="size-4" />
          Search guests, tickets, rooms
        </span>
        <KbdHint keys={["⌘", "K"]} />
      </button>
      <Button variant="ghost" size="icon" className="md:hidden" onClick={onSearch} aria-label="Open search">
        <Search className="size-5" />
      </Button>
      <ThemeToggle />
      <Button variant="ghost" size="icon" aria-label="Notifications" className="relative hidden min-[390px]:inline-flex">
        <Bell className="size-4" />
        <span className="absolute right-2 top-2 size-2 rounded-full bg-destructive" />
      </Button>
      <Button variant="ghost" size="icon" onClick={onToggleRail} aria-label="Toggle walkie rail" className="hidden lg:inline-flex">
        {railCollapsed ? <PanelRightOpen className="size-4" /> : <PanelRightClose className="size-4" />}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="icon" aria-label="Staff role menu">
            <UserRound className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Amara Singh</DropdownMenuLabel>
          <DropdownMenuItem>Concierge</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>Role settings</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => { window.location.href = "/auth/logout"; }}>Sign out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
