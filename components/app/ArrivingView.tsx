"use client";

import { useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { Button } from "@/components/ui/button";
import { GuestCard } from "@/components/app/GuestCard";
import { PropertyMasthead } from "@/components/app/PropertyMasthead";
import { businessToday, formatLongDate } from "@/lib/format";
import { selectGuestsArrivingWithin, selectTicketsByGuest } from "@/lib/store/selectors";
import { useGuestCrm } from "@/lib/store/store-context";
import type { Guest, TicketCategory } from "@/lib/types";
import { VISUAL_ASSETS } from "@/lib/visual-assets";
import { cn } from "@/lib/utils";

export function ArrivingView() {
  const { state, dispatch } = useGuestCrm();
  const [dateFilter, setDateFilter] = useState<string>("all");
  const guests = selectGuestsArrivingWithin(state, 14);
  const dateStrip = useMemo(
    () => Array.from({ length: 14 }, (_, index) => format(addDays(businessToday(), index + 1), "yyyy-MM-dd")),
    []
  );
  const filteredGuests = dateFilter === "all" ? guests : guests.filter((guest) => guest.arrivalDate === dateFilter);
  const grouped = useMemo(() => {
    return filteredGuests.reduce<Record<string, Guest[]>>((acc, guest) => {
      acc[guest.arrivalDate] = [...(acc[guest.arrivalDate] ?? []), guest];
      return acc;
    }, {});
  }, [filteredGuests]);

  function openGuest(guest: Guest, ticketId?: string) {
    dispatch({ type: "OPEN_GUEST_DETAIL", payload: { guestId: guest.id, ticketId } });
  }

  function talkToGuest(guest: Guest) {
    dispatch({ type: "SET_FOCUSED_GUEST", payload: { guestId: guest.id } });
  }

  function addTicket(guest: Guest, category?: TicketCategory) {
    dispatch({ type: "OPEN_NEW_TICKET", payload: { guestId: guest.id, category } });
  }

  return (
    <div className="px-safe py-6 md:px-8">
      <PropertyMasthead
        asset={VISUAL_ASSETS.poolRetreat}
        eyebrow="Arrivals · Next 14 days"
        title="Upcoming stays"
        body="A calm forward view of the guests, occasions, and service details approaching the property."
      />
      <div className="mb-5">
        <h1 className="display-1">Arriving</h1>
        <p className="text-sm text-muted-foreground">Next 14 days, excluding today.</p>
      </div>
      <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
        <Button className="shrink-0" size="sm" variant={dateFilter === "all" ? "default" : "outline"} onClick={() => setDateFilter("all")}>
          All
        </Button>
        {dateStrip.map((date) => (
          <Button
            key={date}
            size="sm"
            variant={dateFilter === date ? "default" : "outline"}
            onClick={() => setDateFilter(date)}
            className={cn("shrink-0", !guests.some((guest) => guest.arrivalDate === date) && "opacity-50")}
          >
            {format(new Date(`${date}T00:00:00`), "EEE d")}
          </Button>
        ))}
      </div>
      <div className="space-y-8">
        {Object.entries(grouped).map(([date, group]) => (
          <section key={date}>
            <h2 className="display-3 sticky top-[calc(4rem+var(--safe-top))] z-20 mb-4 bg-background/80 py-2 backdrop-blur">{formatLongDate(date)}</h2>
            <div className="grid guest-card-grid gap-5">
              {group.map((guest) => (
                <GuestCard
                  key={guest.id}
                  guest={guest}
                  tickets={selectTicketsByGuest(state, guest.id)}
                  onOpen={openGuest}
                  onTalk={talkToGuest}
                  onAddTicket={addTicket}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
