"use client";

import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GuestAvatar } from "@/components/app/GuestAvatar";
import { EmptyState } from "@/components/app/EmptyState";
import { TicketAccordion } from "@/components/app/TicketAccordion";
import { TicketRow } from "@/components/app/TicketRow";
import { CATEGORY_META, CATEGORY_ORDER } from "@/lib/categories";
import {
  formatAge,
  formatGuestStatus,
  formatLongDate,
  formatRole,
  guestDisplayName,
  nightCount
} from "@/lib/format";
import { selectGuestById, selectTicketsByGuest, sortTickets } from "@/lib/store/selectors";
import { useGuestCrm } from "@/lib/store/store-context";
import type { Ticket } from "@/lib/types";
import { cn } from "@/lib/utils";

export function GuestDetail({ guestId, mode = "route" }: { guestId: string; mode?: "route" | "drawer" }) {
  const { state, dispatch } = useGuestCrm();
  const guest = selectGuestById(state, guestId);
  const tickets = selectTicketsByGuest(state, guestId);

  if (!guest) {
    return <EmptyState title="Guest not found" body="This guest is not in the current Rosewood roster." />;
  }

  const events = tickets
    .flatMap((ticket) => ticket.events.map((event) => ({ ...event, ticket })))
    .toSorted((a, b) => b.at.localeCompare(a.at));
  const currentGuestId = guest.id;

  function openTicket(ticket: Ticket) {
    dispatch({ type: "OPEN_GUEST_DETAIL", payload: { guestId: currentGuestId, ticketId: ticket.id } });
    window.setTimeout(() => document.getElementById(ticket.id)?.scrollIntoView({ block: "center" }), 0);
  }

  return (
    <div className={cn("mx-auto w-full max-w-5xl", mode === "drawer" ? "pb-8" : "px-4 py-6 md:px-8")}>
      <section className="rounded-lg border bg-background/72 p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <GuestAvatar guest={guest} className="size-16" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="display-2">{guestDisplayName(guest)}</h1>
              {guest.vip ? <Badge variant="champagne">VIP</Badge> : null}
              <Badge variant="secondary">{guest.loyaltyTier}</Badge>
              <Badge variant="outline">{formatGuestStatus(guest.status)}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {guest.pronouns ? `${guest.pronouns} · ` : ""}
              {guest.languages.map((language) => language.toUpperCase()).join(", ")}
              {guest.homeCity ? ` · ${guest.homeCity}` : ""}
            </p>
            <p className="mt-3 text-sm">
              {formatLongDate(guest.arrivalDate)} to {formatLongDate(guest.departureDate)} · {nightCount(guest)} nights ·{" "}
              {guest.roomNumber ? `Room ${guest.roomNumber}` : "Room pending"} · {guest.roomType}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => dispatch({ type: "SET_FOCUSED_GUEST", payload: { guestId: guest.id } })}>
              Talk to file
            </Button>
            <Button onClick={() => dispatch({ type: "OPEN_NEW_TICKET", payload: { guestId: guest.id } })}>New ticket</Button>
          </div>
        </div>
      </section>

      <Tabs defaultValue="overview" className="mt-5">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tickets">Tickets</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <div className="rounded-lg border bg-background/72 p-5">
              <h2 className="display-3">Notes</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{guest.notes ?? "No long-form notes yet."}</p>
            </div>
            <div className="rounded-lg border bg-background/72 p-5">
              <h2 className="display-3">Stay details</h2>
              <dl className="mt-3 grid gap-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Party</dt>
                  <dd>{guest.partySize}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Occasion</dt>
                  <dd>{guest.occasion ?? "None"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Open tickets</dt>
                  <dd>{tickets.filter((ticket) => ticket.status !== "resolved").length}</dd>
                </div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                {guest.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="tickets">
          <div className="rounded-lg border bg-background/72 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="display-3">Tickets by category</h2>
              <Button onClick={() => dispatch({ type: "OPEN_NEW_TICKET", payload: { guestId: guest.id } })}>New ticket</Button>
            </div>
            <TicketAccordion tickets={tickets} onOpenTicket={openTicket} />
            <div className="mt-6 grid gap-4">
              {CATEGORY_ORDER.map((category) => {
                const categoryTickets = tickets.filter((ticket) => ticket.category === category).toSorted(sortTickets);
                if (categoryTickets.length === 0) return null;
                const meta = CATEGORY_META[category];
                const Icon = meta.Icon;
                return (
                  <section key={category}>
                    <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                      <Icon className="size-4" style={{ color: `var(${meta.colorVar})` }} />
                      {meta.label}
                    </h3>
                    <div className="space-y-1">
                      {categoryTickets.map((ticket) => (
                        <TicketRow key={ticket.id} ticket={ticket} onOpen={openTicket} />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="preferences">
          <EmptyState
            title="Preference intelligence coming soon."
            body="Phase 2 will replace this placeholder with recommendation signals. Phase 1 intentionally leaves it empty."
            icon={Sparkles}
          />
        </TabsContent>

        <TabsContent value="activity">
          <div className="rounded-lg border bg-background/72 p-5">
            <h2 className="display-3">Activity</h2>
            <div className="mt-4 space-y-3">
              {events.map((event) => (
                <div key={event.id} className="grid grid-cols-[96px_minmax(0,1fr)] gap-3 rounded-md border bg-secondary/30 p-3 text-sm">
                  <div className="font-mono text-xs text-muted-foreground">{formatAge(event.at)}</div>
                  <div>
                    <p className="font-medium">
                      {event.actorName} {event.type.replace("_", " ")} · {event.ticket.title}
                    </p>
                    {event.escalatedTo ? <p className="text-xs text-muted-foreground">Escalated to {formatRole(event.escalatedTo)}</p> : null}
                    {event.body ? <p className="mt-1 text-muted-foreground">{event.body}</p> : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
