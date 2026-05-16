"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Home, Radio, Settings, Ticket, UsersRound } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/today", label: "Today", Icon: Home },
  { href: "/arriving", label: "Arriving", Icon: CalendarDays },
  { href: "/guests", label: "Guests", Icon: UsersRound },
  { href: "/tickets", label: "Tickets", Icon: Ticket },
  { href: "/radio", label: "Radio", Icon: Radio }
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <aside className="flex h-full flex-col p-4">
      <div className="px-2 pb-6">
        <div className="font-serif text-2xl font-medium">Rosewood</div>
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Guest CRM</p>
      </div>
      <nav className="space-y-1">
        {navItems.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={cn(
                "flex min-h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
                active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <Separator className="my-4" />
      <button
        type="button"
        className="flex min-h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
      >
        <Settings className="size-4" />
        Settings
      </button>
      <div className="mt-auto rounded-lg border bg-background/50 p-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">On shift</p>
        <p className="mt-1">Concierge, front desk, housekeeping, F+B, spa, and security are synced.</p>
      </div>
    </aside>
  );
}
