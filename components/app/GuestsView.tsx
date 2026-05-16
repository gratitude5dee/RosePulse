"use client";

import { useMemo, useState, useDeferredValue } from "react";
import { LayoutGrid, ListFilter, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { GuestCard } from "@/components/app/GuestCard";
import { GuestAvatar } from "@/components/app/GuestAvatar";
import { CATEGORY_META, CATEGORY_ORDER } from "@/lib/categories";
import { formatAge, formatGuestStatus, guestDisplayName } from "@/lib/format";
import {
  selectAllGuests,
  selectGuestLastActivity,
  selectOpenTicketCountByGuest,
  selectTicketsByGuest
} from "@/lib/store/selectors";
import { useGuestCrm } from "@/lib/store/store-context";
import type { Guest, GuestStatus, LoyaltyTier, TicketCategory } from "@/lib/types";

const statuses: Array<GuestStatus | "all"> = ["all", "arriving_today", "checked_in", "in_house", "departing_today", "upcoming", "checked_out"];
const loyalties: Array<LoyaltyTier | "all"> = ["all", "Standard", "Silver", "Gold", "Platinum", "Founder"];

export function GuestsView() {
  const { state, dispatch } = useGuestCrm();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<GuestStatus | "all">("all");
  const [loyaltyFilter, setLoyaltyFilter] = useState<LoyaltyTier | "all">("all");
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [view, setView] = useState<"cards" | "table">("cards");
  const deferredSearch = useDeferredValue(search);
  const allTags = useMemo(() => Array.from(new Set(state.guests.flatMap((guest) => guest.tags))).toSorted(), [state.guests]);
  const guests = selectAllGuests(state, { search: deferredSearch, statusFilter, tagFilter, loyaltyFilter });

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
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="display-1">Guests</h1>
          <p className="text-sm text-muted-foreground">Searchable guest memory across the property.</p>
        </div>
        <div className="flex gap-2">
          <Button variant={view === "cards" ? "default" : "outline"} size="sm" onClick={() => setView("cards")}>
            <LayoutGrid className="size-4" />
            Cards
          </Button>
          <Button variant={view === "table" ? "default" : "outline"} size="sm" onClick={() => setView("table")}>
            <Table2 className="size-4" />
            Table
          </Button>
        </div>
      </div>

      <div className="mb-5 grid gap-3 rounded-lg border bg-background/62 p-3 lg:grid-cols-[minmax(240px,1fr)_180px_180px_220px]">
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, room, tag, city" />
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as GuestStatus | "all")}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statuses.map((status) => (
              <SelectItem key={status} value={status}>
                {status === "all" ? "All statuses" : formatGuestStatus(status)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={loyaltyFilter} onValueChange={(value) => setLoyaltyFilter(value as LoyaltyTier | "all")}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {loyalties.map((tier) => (
              <SelectItem key={tier} value={tier}>
                {tier === "all" ? "All loyalty" : tier}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value="tag"
          onValueChange={(tag) => {
            if (!tagFilter.includes(tag)) setTagFilter((current) => [...current, tag]);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Add tag filter" />
          </SelectTrigger>
          <SelectContent>
            {allTags.map((tag) => (
              <SelectItem key={tag} value={tag}>
                {tag}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {tagFilter.length > 0 ? (
        <div className="mb-5 flex flex-wrap items-center gap-2 text-sm">
          <ListFilter className="size-4 text-muted-foreground" />
          {tagFilter.map((tag) => (
            <button
              key={tag}
              type="button"
              className="rounded-full bg-secondary px-3 py-1 text-xs"
              onClick={() => setTagFilter((current) => current.filter((item) => item !== tag))}
            >
              {tag} x
            </button>
          ))}
        </div>
      ) : null}

      {view === "cards" ? (
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
      ) : (
        <>
          <div className="grid gap-3 md:hidden">
            {guests.map((guest) => {
              const tickets = selectTicketsByGuest(state, guest.id);
              const openCount = selectOpenTicketCountByGuest(state, guest.id);
              const lastActivity = selectGuestLastActivity(state, guest.id);
              return (
                <div
                  role="button"
                  tabIndex={0}
                  key={guest.id}
                  onClick={() => openGuest(guest)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openGuest(guest);
                    }
                  }}
                  className="rounded-lg border bg-background/72 p-4 text-left"
                >
                  <div className="flex items-start gap-3">
                    <GuestAvatar guest={guest} className="size-11" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{guestDisplayName(guest)}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {formatGuestStatus(guest.status)} · {guest.roomNumber ?? "Pending room"}
                          </p>
                        </div>
                        <Badge variant={["Gold", "Platinum", "Founder"].includes(guest.loyaltyTier) ? "champagne" : "secondary"}>
                          {guest.loyaltyTier}
                        </Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{openCount} open tickets</span>
                        <span className="flex gap-1" aria-label="Active ticket categories">
                          {CATEGORY_ORDER.filter((item) => tickets.some((ticket) => ticket.category === item && ticket.status !== "resolved")).map((item) => (
                            <span key={item} className="size-2 rounded-full" style={{ background: `var(${CATEGORY_META[item].colorVar})` }} />
                          ))}
                        </span>
                        <span>{lastActivity ? `${formatAge(lastActivity)} activity` : "No activity"}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="mt-3 min-h-10 w-full"
                        onClick={(event) => {
                          event.stopPropagation();
                          addTicket(guest);
                        }}
                      >
                        Add ticket
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="hidden rounded-lg border bg-background/72 md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Guest</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>Loyalty</TableHead>
                  <TableHead>Open tickets</TableHead>
                  <TableHead>Last activity</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {guests.map((guest) => {
                  const tickets = selectTicketsByGuest(state, guest.id);
                  const openCount = selectOpenTicketCountByGuest(state, guest.id);
                  const lastActivity = selectGuestLastActivity(state, guest.id);
                  return (
                    <TableRow key={guest.id} className="cursor-pointer" onClick={() => openGuest(guest)}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <GuestAvatar guest={guest} className="size-9" />
                          <div>
                            <div className="font-medium">{guestDisplayName(guest)}</div>
                            <div className="text-xs text-muted-foreground">{guest.homeCity}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{formatGuestStatus(guest.status)}</TableCell>
                      <TableCell>{guest.roomNumber ?? "Pending"}</TableCell>
                      <TableCell>
                        <Badge variant={["Gold", "Platinum", "Founder"].includes(guest.loyaltyTier) ? "champagne" : "secondary"}>
                          {guest.loyaltyTier}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{openCount}</span>
                          <span className="flex gap-1">
                            {CATEGORY_ORDER.filter((item) => tickets.some((ticket) => ticket.category === item && ticket.status !== "resolved")).map((item) => (
                              <span key={item} className="size-2 rounded-full" style={{ background: `var(${CATEGORY_META[item].colorVar})` }} />
                            ))}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{lastActivity ? formatAge(lastActivity) : "None"}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(event) => {
                            event.stopPropagation();
                            addTicket(guest);
                          }}
                        >
                          Add ticket
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
