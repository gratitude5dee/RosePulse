"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { MessageCircle, Plus, Star, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CategoryChip } from "@/components/app/CategoryChip";
import { GuestAvatar } from "@/components/app/GuestAvatar";
import { TicketAccordion } from "@/components/app/TicketAccordion";
import { CATEGORY_ORDER, PRIORITY_META } from "@/lib/categories";
import { guestDisplayName, staySummary } from "@/lib/format";
import { isActiveTicket, isActiveVoiceMemo, sortTickets } from "@/lib/store/selectors";
import type { CategoryFocus, Guest, Ticket, TicketCategory, TicketPriority, VoiceNoteMemo } from "@/lib/types";
import { cn } from "@/lib/utils";
import { getGuestVisualAsset } from "@/lib/visual-assets";

export function GuestCard({
  guest,
  tickets,
  voiceMemos = [],
  focusedCategory = "all",
  onOpen,
  onTalk,
  onAddTicket,
  className
}: {
  guest: Guest;
  tickets: Ticket[];
  voiceMemos?: VoiceNoteMemo[];
  focusedCategory?: CategoryFocus;
  onOpen: (guest: Guest, ticketId?: string) => void;
  onTalk: (guest: Guest) => void;
  onAddTicket: (guest: Guest, category?: TicketCategory) => void;
  className?: string;
}) {
  const [openCategories, setOpenCategories] = useState<TicketCategory[]>([]);
  const longPressRef = useRef<number | null>(null);

  const activeTickets = useMemo(() => tickets.filter(isActiveTicket).toSorted(sortTickets), [tickets]);
  const activeMemos = useMemo(
    () =>
      voiceMemos
        .filter(isActiveVoiceMemo)
        .toSorted(
          (a, b) =>
            PRIORITY_META[b.priority].sortWeight - PRIORITY_META[a.priority].sortWeight ||
            (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt)
        ),
    [voiceMemos]
  );
  const visual = useMemo(() => getGuestVisualAsset(guest, activeTickets), [guest, activeTickets]);
  const categoryCounts = useMemo(() => {
    return CATEGORY_ORDER.reduce<Record<TicketCategory, { count: number; peak?: TicketPriority }>>((acc, category) => {
      const categoryTickets = activeTickets.filter((ticket) => ticket.category === category);
      const categoryMemos = activeMemos.filter((memo) => memo.category === category);
      acc[category] = {
        count: categoryTickets.length + categoryMemos.length,
        peak: highestPriority([...categoryTickets.map((ticket) => ticket.priority), ...categoryMemos.map((memo) => memo.priority)])
      };
      return acc;
    }, {} as Record<TicketCategory, { count: number; peak?: TicketPriority }>);
  }, [activeMemos, activeTickets]);
  const displayedTickets = useMemo(
    () => (focusedCategory === "all" ? activeTickets : activeTickets.filter((ticket) => ticket.category === focusedCategory)),
    [activeTickets, focusedCategory]
  );
  const visibleMemos = useMemo(() => {
    const categories = focusedCategory !== "all" ? [focusedCategory] : openCategories;
    return categories.length > 0
      ? activeMemos.filter((memo) => categories.includes(memo.category)).slice(0, 3)
      : displayedTickets.length === 0
        ? activeMemos.slice(0, 3)
        : [];
  }, [activeMemos, displayedTickets.length, focusedCategory, openCategories]);
  const peakPriority = highestPriority([...activeTickets.map((ticket) => ticket.priority), ...activeMemos.map((memo) => memo.priority)]);

  useEffect(() => {
    if (focusedCategory === "all" || categoryCounts[focusedCategory].count === 0) return;
    setOpenCategories((current) => (current.includes(focusedCategory) ? current : [...current, focusedCategory]));
  }, [categoryCounts, focusedCategory]);

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
      className={cn("flex min-h-[360px] flex-col overflow-hidden rounded-lg p-3 sm:min-h-[440px] sm:p-5", className)}
      onPointerDown={startLongPress}
      onPointerUp={clearLongPress}
      onPointerLeave={clearLongPress}
      onPointerCancel={clearLongPress}
    >
      <div className="relative -mx-3 -mt-3 mb-3 h-24 overflow-hidden rounded-t-[calc(var(--radius)-1px)] bg-secondary sm:-mx-5 sm:-mt-5 sm:mb-5 sm:h-32">
        <Image
          src={visual.src}
          alt={visual.alt}
          fill
          sizes="(min-width: 1536px) 25vw, (min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_42%,oklch(0.18_0.015_60/0.22))]" />
      </div>

      <div className="flex items-start gap-3">
        <GuestAvatar guest={guest} className="size-11 sm:size-12" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate font-serif text-[1.45rem] font-medium leading-7 tracking-normal sm:text-[1.375rem] sm:leading-7">
                {guestDisplayName(guest)}
              </h2>
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

      <div className="mt-4 grid grid-cols-3 gap-1.5 sm:mt-5 sm:gap-2">
        {CATEGORY_ORDER.map((category) => (
          <CategoryChip
            key={category}
            category={category}
            count={categoryCounts[category].count}
            priorityPeak={categoryCounts[category].peak}
            active={openCategories.includes(category) || focusedCategory === category}
            disabled={categoryCounts[category].count === 0}
            onClick={() => toggleCategory(category)}
          />
        ))}
      </div>

      <div className="mt-4 flex-1">
        {displayedTickets.length === 0 && visibleMemos.length === 0 ? (
          <p className="rounded-md bg-secondary/40 px-3 py-3 text-sm italic text-muted-foreground">No active requests.</p>
        ) : (
          <>
            {displayedTickets.length > 0 ? (
              <TicketAccordion
                tickets={displayedTickets}
                activeCategories={openCategories}
                onCategoriesChange={setOpenCategories}
                maxVisible={3}
                onOpenTicket={(ticket) => onOpen(guest, ticket.id)}
              />
            ) : null}
            {visibleMemos.length > 0 ? (
              <div className="mt-3 rounded-md border bg-secondary/30 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Voice memos</span>
                  <span className="font-mono text-[11px] text-muted-foreground">{visibleMemos.length}</span>
                </div>
                <div className="space-y-2">
                  {visibleMemos.map((memo) => (
                    <button
                      type="button"
                      key={memo.id}
                      onClick={() => (memo.ticketId ? onOpen(guest, memo.ticketId) : onOpen(guest))}
                      className="w-full rounded-md bg-background/70 px-3 py-2 text-left text-xs hover:bg-background"
                    >
                      <span className="block truncate font-medium">{memo.title}</span>
                      <span className="mt-0.5 line-clamp-2 text-muted-foreground">{memo.transcript}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t pt-3 sm:mt-4 sm:gap-2 sm:pt-4">
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
        {peakPriority ? (
          <span className="ml-auto text-xs text-muted-foreground">
            Peak <span style={{ color: `var(${PRIORITY_META[peakPriority].colorVar})` }}>{PRIORITY_META[peakPriority].label}</span>
          </span>
        ) : null}
      </div>
    </article>
  );
}

function highestPriority(priorities: TicketPriority[]) {
  return priorities.toSorted((a, b) => PRIORITY_META[b].sortWeight - PRIORITY_META[a].sortWeight)[0];
}
