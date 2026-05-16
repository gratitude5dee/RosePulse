"use client";

import { Inbox } from "lucide-react";
import { GuestCard } from "@/components/app/GuestCard";
import { EmptyState } from "@/components/app/EmptyState";
import { formatLongDate, guestDisplayName } from "@/lib/format";
import { selectGuestsArrivingToday, selectTicketsByGuest } from "@/lib/store/selectors";
import { useGuestCrm } from "@/lib/store/store-context";
import type { Guest, TicketCategory } from "@/lib/types";

export function TodayView() {
  const { state, dispatch } = useGuestCrm();
  const guests = selectGuestsArrivingToday(state);
  const arrivals = guests.filter((guest) => guest.status === "arriving_today").length;
  const urgentOpen = state.tickets.filter((ticket) => ticket.priority === "urgent" && ticket.status !== "resolved").length;
  const openTotal = state.tickets.filter((ticket) => ticket.status !== "resolved").length;
  const resolvedToday = state.tickets.filter((ticket) => ticket.status === "resolved").length;

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
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="display-1">Today</h1>
          <p className="text-sm text-muted-foreground">{formatLongDate(new Date())}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 rounded-lg border bg-background/62 p-2 text-sm shadow-sm sm:grid-cols-4">
          <Metric value={arrivals} label="arrivals" />
          <Metric value={urgentOpen} label="open urgent" />
          <Metric value={openTotal} label="open total" />
          <Metric value={resolvedToday} label="resolved today" />
        </div>
      </div>

      {state.unfiledNotes.length > 0 ? (
        <section className="mb-6 rounded-lg border border-accent/40 bg-accent/10 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Inbox className="size-4 text-primary" />
            <h2 className="text-sm font-semibold">Unfiled voice notes</h2>
          </div>
          <div className="grid gap-2">
            {state.unfiledNotes.map((note) => (
              <div key={note.id} className="flex flex-col gap-3 rounded-md bg-background/70 p-3 text-sm sm:flex-row sm:items-center">
                <p className="flex-1 text-muted-foreground">{note.transcript}</p>
                <select
                  className="h-10 rounded-md border bg-background px-2 text-sm"
                  defaultValue=""
                  onChange={(event) => {
                    if (event.target.value) {
                      dispatch({ type: "FILE_UNFILED_NOTE", payload: { noteId: note.id, guestId: event.target.value } });
                    }
                  }}
                >
                  <option value="" disabled>
                    File to guest
                  </option>
                  {state.guests.map((guest) => (
                    <option key={guest.id} value={guest.id}>
                      {guestDisplayName(guest)}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {guests.length === 0 ? (
        <EmptyState title="No arrivals on the board" body="The current fixture set has no arriving or in-house guests for today." />
      ) : (
        <div className="grid guest-card-grid gap-5">
          {guests.map((guest) => (
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
      )}
    </div>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div className="min-w-24 rounded-md px-3 py-2">
      <div className="font-mono text-xl font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
