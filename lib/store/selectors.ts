import { addDays, isAfter, isBefore, isSameDay, parseISO } from "date-fns";
import { PRIORITY_META } from "@/lib/categories";
import { businessToday, guestDisplayName } from "@/lib/format";
import type { Guest, GuestCrmState, GuestStatus, Ticket, TicketCategory, TicketPriority, TicketStatus } from "@/lib/types";

export interface GuestFilters {
  search?: string;
  statusFilter?: GuestStatus | "all";
  tagFilter?: string[];
  loyaltyFilter?: string | "all";
}

export interface TicketFilters {
  category?: TicketCategory | "all";
  priority?: TicketPriority | "all";
  status?: TicketStatus | "all";
  assignedTo?: string | "all";
}

export function isActiveTicket(ticket: Ticket) {
  return ticket.status !== "resolved";
}

export function selectGuestsArrivingToday(state: GuestCrmState) {
  return sortGuestsForToday(
    state.guests.filter((guest) => guest.status === "arriving_today" || guest.status === "in_house")
  );
}

export function selectGuestsArrivingWithin(state: GuestCrmState, days = 14) {
  const today = businessToday();
  const end = addDays(today, days);
  return state.guests
    .filter((guest) => {
      const arrival = parseISO(guest.arrivalDate);
      return guest.status === "upcoming" && isAfter(arrival, today) && (isBefore(arrival, end) || isSameDay(arrival, end));
    })
    .toSorted((a, b) => a.arrivalDate.localeCompare(b.arrivalDate) || guestDisplayName(a).localeCompare(guestDisplayName(b)));
}

export function selectAllGuests(state: GuestCrmState, filters: GuestFilters) {
  const search = filters.search?.trim().toLowerCase() ?? "";
  return state.guests.filter((guest) => {
    const room = guest.roomNumber ?? "";
    const searchable = [guestDisplayName(guest), guest.firstName, guest.lastName, room, guest.homeCity ?? "", ...guest.tags]
      .join(" ")
      .toLowerCase();
    const matchesSearch = !search || searchable.includes(search);
    const matchesStatus = !filters.statusFilter || filters.statusFilter === "all" || guest.status === filters.statusFilter;
    const matchesLoyalty = !filters.loyaltyFilter || filters.loyaltyFilter === "all" || guest.loyaltyTier === filters.loyaltyFilter;
    const selectedTags = filters.tagFilter ?? [];
    const matchesTags = selectedTags.length === 0 || selectedTags.every((tag) => guest.tags.includes(tag));
    return matchesSearch && matchesStatus && matchesLoyalty && matchesTags;
  });
}

export function selectTicketsByGuest(state: GuestCrmState, guestId: string) {
  return state.tickets
    .filter((ticket) => ticket.guestId === guestId)
    .toSorted((a, b) => sortTickets(a, b));
}

export function selectTicketsByGuestAndCategory(state: GuestCrmState, guestId: string, category: TicketCategory) {
  return selectTicketsByGuest(state, guestId).filter((ticket) => ticket.category === category);
}

export function selectTicketBoard(state: GuestCrmState, filters: TicketFilters) {
  return state.tickets
    .filter((ticket) => {
      const category = !filters.category || filters.category === "all" || ticket.category === filters.category;
      const priority = !filters.priority || filters.priority === "all" || ticket.priority === filters.priority;
      const status = !filters.status || filters.status === "all" || ticket.status === filters.status;
      const assigned = !filters.assignedTo || filters.assignedTo === "all" || ticket.assignedTo === filters.assignedTo;
      return category && priority && status && assigned;
    })
    .toSorted((a, b) => sortTickets(a, b));
}

export function selectGuestById(state: GuestCrmState, guestId: string) {
  return state.guests.find((guest) => guest.id === guestId);
}

export function selectTicketById(state: GuestCrmState, ticketId: string) {
  return state.tickets.find((ticket) => ticket.id === ticketId);
}

export function selectOpenTicketCountByGuest(state: GuestCrmState, guestId: string) {
  return state.tickets.filter((ticket) => ticket.guestId === guestId && isActiveTicket(ticket)).length;
}

export function selectGuestLastActivity(state: GuestCrmState, guestId: string) {
  return state.tickets
    .filter((ticket) => ticket.guestId === guestId)
    .flatMap((ticket) => ticket.events)
    .toSorted((a, b) => b.at.localeCompare(a.at))[0]?.at;
}

export function sortTickets(a: Ticket, b: Ticket) {
  return (
    PRIORITY_META[b.priority].sortWeight - PRIORITY_META[a.priority].sortWeight ||
    b.updatedAt.localeCompare(a.updatedAt)
  );
}

function sortGuestsForToday(guests: Guest[]) {
  const bucketWeight = (guest: Guest) => (guest.status === "arriving_today" ? 0 : 1);
  return guests.toSorted(
    (a, b) =>
      bucketWeight(a) - bucketWeight(b) ||
      Number(b.vip) - Number(a.vip) ||
      guestDisplayName(a).localeCompare(guestDisplayName(b))
  );
}
