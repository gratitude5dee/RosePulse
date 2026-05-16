"use client";

import { useMemo, useRef, useState } from "react";
import { MessageCircle, Plus, Star, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CategoryChip } from "@/components/app/CategoryChip";
import { GuestAvatar } from "@/components/app/GuestAvatar";
import { TicketAccordion } from "@/components/app/TicketAccordion";
import { CATEGORY_ORDER, PRIORITY_META } from "@/lib/categories";
import { guestDisplayName, staySummary } from "@/lib/format";
import { isActiveTicket, sortTickets } from "@/lib/store/selectors";
import type { Guest, Ticket, TicketCategory, TicketPriority } from "@/lib/types";
import { cn } from "@/lib/utils";

export function GuestCard({
  guest,
  tickets,
  onOpen,
  onTalk,
  onAddTicket,
  className
}: {
  guest: Guest;
  tickets: Ticket[];
  onOpen: (guest: Guest, ticketId?: string) => void;
  onTalk: (guest: Guest) => void;
  onAddTicket: (guest: Guest, category?: TicketCategory) => void;
  className?: string;
}) {
  const [openCategories, setOpenCategories] = useState<TicketCategory[]>([]);
  const longPressRef = useRef<number | null>(null);

  const activeTickets = useMemo(() => tickets.filter(isActiveTicket).toSorted(sortTickets), [tickets]);
  const categoryCounts = useMemo(() => {
    return CATEGORY_ORDER.reduce<Record<TicketCategory, { count: number; peak?: TicketPriority }>>((acc, category) => {
      const categoryTickets = activeTickets.filter((ticket) => ticket.category === category);
      acc[category] = {
        count: categoryTickets.length,
        peak: categoryTickets.toSorted(sortTickets)[0]?.priority
      };
      return acc;
    }, {} as Record<TicketCategory, { count: number; peak?: TicketPriority }>);
  }, [activeTickets]);

  function toggleCategory(category: TicketCategory) {
    if (categoryCounts[category].count === 0) return;
    setOpenCategories((current) => {
      const next = current.includes(category) ? current.filter((item) => item !== category) : [...current, category];
      window.setTimeout(() => document.getElementById(`accordion-${category}`)?.scrollIntoView({ block: "nearest" }), 0);
      return next;
    });
  }

  function startLongPress() {
    longPressRef.current = window.setTimeout(() => onTalk(guest), 400);
  }

  function clearLongPress() {
    if (longPressRef.current !== null) {
      window.clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }

  return (
    <article
      data-tier="editorial"
      className={cn("flex min-h-[340px] flex-col rounded-lg p-4 sm:min-h-[360px] sm:p-5", className)}
      onPointerDown={startLongPress}
      onPointerUp={clearLongPress}
      onPointerLeave={clearLongPress}
      onPointerCancel={clearLongPress}
    >
      <div className="flex items-start gap-3">
        <GuestAvatar guest={guest} className="size-11 sm:size-12" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="display-3 truncate">{guestDisplayName(guest)}</h2>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{staySummary(guest)}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {["Gold", "Platinum", "Founder"].includes(guest.loyaltyTier) ? (
                <Badge variant="champagne" className="hidden sm:inline-flex">
                  {guest.loyaltyTier}
                </Badge>
              ) : null}
              {guest.vip ? <Star className="size-4 fill-accent text-accent" aria-label="VIP guest" /> : null}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-1.5 min-[440px]:grid-cols-3 sm:gap-2">
        {CATEGORY_ORDER.map((category) => (
          <CategoryChip
            key={category}
            category={category}
            count={categoryCounts[category].count}
            priorityPeak={categoryCounts[category].peak}
            active={openCategories.includes(category)}
            disabled={categoryCounts[category].count === 0}
            onClick={() => toggleCategory(category)}
          />
        ))}
      </div>

      <div className="mt-4 flex-1">
        {activeTickets.length === 0 ? (
          <p className="rounded-md bg-secondary/40 px-3 py-3 text-sm italic text-muted-foreground">No active requests.</p>
        ) : (
          <TicketAccordion
            tickets={activeTickets}
            activeCategories={openCategories}
            onCategoriesChange={setOpenCategories}
            maxVisible={3}
            onOpenTicket={(ticket) => onOpen(guest, ticket.id)}
          />
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
        <Button variant="secondary" size="sm" className="min-h-10" onClick={() => onTalk(guest)}>
          <MessageCircle className="size-4" />
          Talk to file
        </Button>
        <Button variant="ghost" size="sm" className="min-h-10" onClick={() => onAddTicket(guest)}>
          <Plus className="size-4" />
          Add ticket
        </Button>
        <Button variant="ghost" size="sm" className="min-h-10" onClick={() => onOpen(guest)}>
          <UserRound className="size-4" />
          Open profile
        </Button>
        {activeTickets[0] ? (
          <span className="ml-auto text-xs text-muted-foreground">
            Peak <span style={{ color: `var(${PRIORITY_META[activeTickets[0].priority].colorVar})` }}>{PRIORITY_META[activeTickets[0].priority].label}</span>
          </span>
        ) : null}
      </div>
    </article>
  );
}
