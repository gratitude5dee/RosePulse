"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  ChevronsLeft,
  ChevronsRight,
  Home,
  Mic2,
  Radio,
  Settings,
  Sparkles,
  Ticket,
  UsersRound
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CategoryOperationsNav } from "@/components/app/CategoryOperationsDock";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/today", label: "Today", Icon: Home },
  { href: "/arriving", label: "Arriving", Icon: CalendarDays },
  { href: "/guests", label: "Guests", Icon: UsersRound },
  { href: "/guest-pulse", label: "GuestPulse", Icon: Sparkles },
  { href: "/tickets", label: "Tickets", Icon: Ticket },
  { href: "/radio", label: "Radio", Icon: Radio },
  { href: "/voice-notes", label: "Voice Memos", Icon: Mic2 }
];

export function Sidebar({
  onNavigate,
  collapsed = false,
  onToggleCollapsed
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const pathname = usePathname();
  return (
    <aside className={cn("flex h-full flex-col transition-[padding] duration-300 ease-out", collapsed ? "p-3" : "p-4")}>
      <div className={cn("flex items-start gap-2 pb-5", collapsed ? "justify-center px-0" : "px-2")}>
        <div className={cn("min-w-0 flex-1", collapsed && "hidden")}>
          <div className="font-serif text-2xl font-medium">Rosewood</div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Guest CRM</p>
        </div>
        {collapsed ? (
          <div className="flex size-10 items-center justify-center rounded-xl border bg-background/70 font-serif text-xl">R</div>
        ) : null}
        {onToggleCollapsed ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="hidden size-9 shrink-0 md:inline-flex"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
          </Button>
        ) : null}
      </div>
      <TooltipProvider delayDuration={150}>
        <nav className="space-y-1">
          {navItems.map(({ href, label, Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            const link = (
              <Link
                key={href}
                href={href}
                onClick={onNavigate}
                aria-label={collapsed ? label : undefined}
                className={cn(
                  "flex min-h-10 items-center gap-3 rounded-md text-sm font-medium transition-colors",
                  collapsed ? "justify-center px-0" : "px-3",
                  active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span className={cn(collapsed && "sr-only")}>{label}</span>
              </Link>
            );

            if (!collapsed) return link;

            return (
              <Tooltip key={href}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right">{label}</TooltipContent>
              </Tooltip>
            );
          })}
        </nav>
      </TooltipProvider>
      <Separator className="my-4" />
      <CategoryOperationsNav collapsed={collapsed} onSelect={onNavigate} />
      <Separator className="my-4" />
      <button
        type="button"
        className={cn(
          "flex min-h-10 items-center gap-3 rounded-md text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground",
          collapsed ? "justify-center px-0" : "px-3"
        )}
        aria-label="Settings"
      >
        <Settings className="size-4 shrink-0" />
        <span className={cn(collapsed && "sr-only")}>Settings</span>
      </button>
      <div className={cn("mt-auto rounded-lg border bg-background/50 p-3 text-xs text-muted-foreground", collapsed && "hidden")}>
        <p className="font-medium text-foreground">On shift</p>
        <p className="mt-1">Concierge, front desk, housekeeping, F+B, spa, and security are synced.</p>
      </div>
    </aside>
  );
}
