import { addDays, isAfter, isBefore, isSameDay, parseISO } from "date-fns";
import { CATEGORY_ORDER, PRIORITY_META } from "@/lib/categories";
import { businessToday, guestDisplayName } from "@/lib/format";
import type {
  CategoryFocus,
  Guest,
  GuestCrmState,
  GuestPreference,
  GuestPreferenceEvidence,
  GuestStatus,
  PreferenceCategory,
  Ticket,
  TicketCategory,
  TicketPriority,
  TicketStatus,
  VoiceNoteMemo,
  VoiceNoteMemoStatus
} from "@/lib/types";

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

export interface VoiceMemoFilters {
  search?: string;
  guestId?: string | "all";
  category?: TicketCategory | "all";
  priority?: TicketPriority | "all";
  status?: VoiceNoteMemoStatus | "all";
  preferenceCategory?: PreferenceCategory | "all";
  from?: string;
  to?: string;
}

export type CategoryWorkItem =
  | {
      type: "ticket";
      id: string;
      title: string;
      category: TicketCategory;
      priority: TicketPriority;
      guestId: string;
      status: TicketStatus;
      activityAt: string;
      dueAt?: string;
      ticket: Ticket;
    }
  | {
      type: "memo";
      id: string;
      title: string;
      category: TicketCategory;
      priority: TicketPriority;
      guestId?: string;
      ticketId?: string;
      status: VoiceNoteMemoStatus;
      activityAt: string;
      transcript: string;
      memo: VoiceNoteMemo;
    };

export interface CategoryOperationSummary {
  category: TicketCategory;
  activeTicketCount: number;
  activeMemoCount: number;
  urgentCount: number;
  highCount: number;
  escalatedBlockedCount: number;
  unfiledMemoCount: number;
  totalActive: number;
  latestActivityAt?: string;
  peakPriority?: TicketPriority;
}

export interface ShiftHandoffSummary {
  since: string;
  urgentTickets: Ticket[];
  highTickets: Ticket[];
  blockedOrEscalatedTickets: Ticket[];
  unfiledMemos: VoiceNoteMemo[];
  newVoiceMemos: VoiceNoteMemo[];
  newPreferences: GuestPreference[];
}

export type AttentionQueueItem =
  | {
      type: "ticket";
      id: string;
      title: string;
      guestId: string;
      priority: TicketPriority;
      reason: "overdue" | "due_soon" | "blocked" | "escalated" | "urgent" | "high";
      activityAt: string;
      ticket: Ticket;
    }
  | {
      type: "memo";
      id: string;
      title: string;
      guestId?: string;
      priority: TicketPriority;
      reason: "unfiled";
      activityAt: string;
      memo: VoiceNoteMemo;
    }
  | {
      type: "preference";
      id: string;
      title: string;
      guestId: string;
      reason: "high_confidence_preference";
      activityAt: string;
      preference: GuestPreference;
    };

const PINNED_TODAY_GUEST_IDS: readonly string[] = ["guest_radha_arora_demo"];

export function isActiveTicket(ticket: Ticket) {
  return ticket.status !== "resolved";
}

export function isActiveVoiceMemo(memo: VoiceNoteMemo) {
  return memo.status !== "archived";
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

export function selectPreferencesByGuest(state: GuestCrmState, guestId: string) {
  return state.preferences
    .filter((preference) => preference.guestId === guestId && preference.status !== "dismissed")
    .toSorted((a, b) => b.confidence - a.confidence || b.updatedAt.localeCompare(a.updatedAt));
}

export function selectRecommendationsByGuest(state: GuestCrmState, guestId: string) {
  return state.recommendations
    .filter((recommendation) => recommendation.guestId === guestId && recommendation.status === "pending")
    .toSorted((a, b) => b.confidence - a.confidence || b.createdAt.localeCompare(a.createdAt));
}

export function selectPreferenceEvidenceByGuest(state: GuestCrmState, guestId: string): GuestPreferenceEvidence[] {
  const preferenceIds = new Set(state.preferences.filter((preference) => preference.guestId === guestId).map((preference) => preference.id));
  return state.preferenceEvidence
    .filter((evidence) => preferenceIds.has(evidence.preferenceId))
    .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function selectVoiceMemos(state: GuestCrmState, filters: VoiceMemoFilters = {}) {
  const search = filters.search?.trim().toLowerCase() ?? "";
  return state.voiceMemos
    .filter((memo) => {
      const searchable = [memo.title, memo.transcript, memo.guestId ?? "", memo.ticketId ?? "", memo.category, memo.priority]
        .join(" ")
        .toLowerCase();
      const matchesSearch = !search || searchable.includes(search);
      const matchesGuest = !filters.guestId || filters.guestId === "all" || memo.guestId === filters.guestId;
      const matchesCategory = !filters.category || filters.category === "all" || memo.category === filters.category;
      const matchesPriority = !filters.priority || filters.priority === "all" || memo.priority === filters.priority;
      const matchesStatus = !filters.status || filters.status === "all" || memo.status === filters.status;
      const matchesPreferenceCategory =
        !filters.preferenceCategory ||
        filters.preferenceCategory === "all" ||
        memo.preferenceCategories.includes(filters.preferenceCategory);
      const matchesFrom = !filters.from || memo.createdAt.slice(0, 10) >= filters.from;
      const matchesTo = !filters.to || memo.createdAt.slice(0, 10) <= filters.to;
      return (
        matchesSearch &&
        matchesGuest &&
        matchesCategory &&
        matchesPriority &&
        matchesStatus &&
        matchesPreferenceCategory &&
        matchesFrom &&
        matchesTo
      );
    })
    .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function selectRecentVoiceMemos(state: GuestCrmState, limit = 8) {
  return state.voiceMemos
    .filter((memo) => memo.status !== "archived")
    .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export function selectVoiceMemosByGuest(state: GuestCrmState, guestId: string) {
  return state.voiceMemos
    .filter((memo) => memo.guestId === guestId && memo.status !== "archived")
    .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function selectCategoryOperations(state: GuestCrmState): CategoryOperationSummary[] {
  return CATEGORY_ORDER.map((category) => {
    const items = selectCategoryWorkItems(state, category);
    return summarizeCategory(category, items);
  }).toSorted((a, b) => sortCategorySummaries(a, b));
}

export function selectShiftHandoff(state: GuestCrmState, hours = 8): ShiftHandoffSummary {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const activeTickets = state.tickets.filter(isActiveTicket);
  return {
    since,
    urgentTickets: activeTickets.filter((ticket) => ticket.priority === "urgent").toSorted(sortTickets),
    highTickets: activeTickets.filter((ticket) => ticket.priority === "high").toSorted(sortTickets),
    blockedOrEscalatedTickets: activeTickets
      .filter((ticket) => ticket.status === "blocked" || ticket.status === "escalated")
      .toSorted(sortTickets),
    unfiledMemos: state.voiceMemos
      .filter((memo) => memo.status === "unfiled")
      .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt)),
    newVoiceMemos: state.voiceMemos
      .filter((memo) => memo.createdAt >= since && memo.status !== "archived")
      .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt)),
    newPreferences: state.preferences
      .filter((preference) => (preference.lastSeenAt ?? preference.updatedAt) >= since && preference.status === "candidate")
      .toSorted((a, b) => b.confidence - a.confidence || b.updatedAt.localeCompare(a.updatedAt))
  };
}

export function selectAttentionQueue(state: GuestCrmState): AttentionQueueItem[] {
  const now = Date.now();
  const dueSoonMs = 2 * 60 * 60 * 1000;
  const tickets: AttentionQueueItem[] = state.tickets
    .filter(isActiveTicket)
    .flatMap((ticket) => {
      const dueAt = ticket.dueAt ? new Date(ticket.dueAt).getTime() : undefined;
      const reason =
        ticket.status === "escalated"
          ? "escalated"
          : ticket.status === "blocked"
            ? "blocked"
            : dueAt && dueAt < now
              ? "overdue"
              : dueAt && dueAt - now <= dueSoonMs
                ? "due_soon"
                : ticket.priority === "urgent"
                  ? "urgent"
                  : ticket.priority === "high"
                    ? "high"
                    : undefined;
      return reason
        ? [
            {
              type: "ticket" as const,
              id: ticket.id,
              title: ticket.title,
              guestId: ticket.guestId,
              priority: ticket.priority,
              reason,
              activityAt: ticket.updatedAt,
              ticket
            }
          ]
        : [];
    });
  const memos: AttentionQueueItem[] = state.voiceMemos
    .filter((memo) => memo.status === "unfiled")
    .map((memo) => ({
      type: "memo" as const,
      id: memo.id,
      title: memo.title,
      guestId: memo.guestId,
      priority: memo.priority,
      reason: "unfiled" as const,
      activityAt: memo.updatedAt || memo.createdAt,
      memo
    }));
  const preferences: AttentionQueueItem[] = state.preferences
    .filter((preference) => preference.status === "candidate" && preference.confidence >= 0.82)
    .map((preference) => ({
      type: "preference" as const,
      id: preference.id,
      title: preference.label,
      guestId: preference.guestId,
      reason: "high_confidence_preference" as const,
      activityAt: preference.lastSeenAt ?? preference.updatedAt,
      preference
    }));

  return [...tickets, ...memos, ...preferences].toSorted(sortAttentionItems).slice(0, 12);
}

export function selectCategoryWorkItems(state: GuestCrmState, category: TicketCategory): CategoryWorkItem[] {
  const tickets: CategoryWorkItem[] = state.tickets
    .filter((ticket) => ticket.category === category && isActiveTicket(ticket))
    .map((ticket) => ({
      type: "ticket" as const,
      id: ticket.id,
      title: ticket.title,
      category: ticket.category,
      priority: ticket.priority,
      guestId: ticket.guestId,
      status: ticket.status,
      activityAt: ticket.updatedAt,
      dueAt: ticket.dueAt,
      ticket
    }));
  const memos: CategoryWorkItem[] = state.voiceMemos
    .filter((memo) => memo.category === category && isActiveVoiceMemo(memo))
    .map((memo) => ({
      type: "memo" as const,
      id: memo.id,
      title: memo.title,
      category: memo.category,
      priority: memo.priority,
      guestId: memo.guestId,
      ticketId: memo.ticketId,
      status: memo.status,
      activityAt: memo.updatedAt || memo.createdAt,
      transcript: memo.transcript,
      memo
    }));
  return [...tickets, ...memos].toSorted(sortCategoryWorkItems);
}

export function selectGuestHasCategoryWork(state: GuestCrmState, guestId: string, category: CategoryFocus) {
  if (category === "all") return true;
  return (
    state.tickets.some((ticket) => ticket.guestId === guestId && ticket.category === category && isActiveTicket(ticket)) ||
    state.voiceMemos.some((memo) => memo.guestId === guestId && memo.category === category && isActiveVoiceMemo(memo))
  );
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

export function sortCategoryWorkItems(a: CategoryWorkItem, b: CategoryWorkItem) {
  const dueA = a.type === "ticket" ? a.dueAt : undefined;
  const dueB = b.type === "ticket" ? b.dueAt : undefined;
  return (
    PRIORITY_META[b.priority].sortWeight - PRIORITY_META[a.priority].sortWeight ||
    statusUrgency(b) - statusUrgency(a) ||
    compareDueDates(dueA, dueB) ||
    b.activityAt.localeCompare(a.activityAt) ||
    (a.type === b.type ? 0 : a.type === "ticket" ? -1 : 1)
  );
}

function summarizeCategory(category: TicketCategory, items: CategoryWorkItem[]): CategoryOperationSummary {
  const activeTicketCount = items.filter((item) => item.type === "ticket").length;
  const activeMemoCount = items.filter((item) => item.type === "memo").length;
  return {
    category,
    activeTicketCount,
    activeMemoCount,
    urgentCount: items.filter((item) => item.priority === "urgent").length,
    highCount: items.filter((item) => item.priority === "high").length,
    escalatedBlockedCount: items.filter((item) => item.type === "ticket" && (item.status === "escalated" || item.status === "blocked")).length,
    unfiledMemoCount: items.filter((item) => item.type === "memo" && item.status === "unfiled").length,
    totalActive: activeTicketCount + activeMemoCount,
    latestActivityAt: items.toSorted((a, b) => b.activityAt.localeCompare(a.activityAt))[0]?.activityAt,
    peakPriority: items[0]?.priority
  };
}

function sortCategorySummaries(a: CategoryOperationSummary, b: CategoryOperationSummary) {
  return (
    b.urgentCount - a.urgentCount ||
    b.highCount - a.highCount ||
    b.escalatedBlockedCount - a.escalatedBlockedCount ||
    b.unfiledMemoCount - a.unfiledMemoCount ||
    b.totalActive - a.totalActive ||
    (b.latestActivityAt ?? "").localeCompare(a.latestActivityAt ?? "") ||
    CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category)
  );
}

function sortAttentionItems(a: AttentionQueueItem, b: AttentionQueueItem) {
  return (
    attentionReasonWeight(b.reason) - attentionReasonWeight(a.reason) ||
    ("priority" in b ? PRIORITY_META[b.priority].sortWeight : 0) - ("priority" in a ? PRIORITY_META[a.priority].sortWeight : 0) ||
    b.activityAt.localeCompare(a.activityAt) ||
    attentionTypeWeight(a.type) - attentionTypeWeight(b.type)
  );
}

function attentionReasonWeight(reason: AttentionQueueItem["reason"]) {
  if (reason === "overdue") return 7;
  if (reason === "escalated") return 6;
  if (reason === "blocked") return 5;
  if (reason === "urgent") return 4;
  if (reason === "due_soon") return 3;
  if (reason === "unfiled") return 2;
  if (reason === "high_confidence_preference") return 2;
  if (reason === "high") return 1;
  return 0;
}

function attentionTypeWeight(type: AttentionQueueItem["type"]) {
  if (type === "ticket") return 0;
  if (type === "memo") return 1;
  return 2;
}

function statusUrgency(item: CategoryWorkItem) {
  if (item.type === "ticket") {
    if (item.status === "escalated") return 4;
    if (item.status === "blocked") return 3;
    if (item.status === "open") return 2;
    if (item.status === "in_progress") return 1;
    return 0;
  }
  if (item.status === "unfiled") return 3;
  if (item.status === "attached") return 2;
  if (item.status === "filed") return 1;
  return 0;
}

function compareDueDates(a?: string, b?: string) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b);
}

function sortGuestsForToday(guests: Guest[]) {
  const pinnedWeight = (guest: Guest) => {
    const index = PINNED_TODAY_GUEST_IDS.indexOf(guest.id);
    return index === -1 ? PINNED_TODAY_GUEST_IDS.length : index;
  };
  const bucketWeight = (guest: Guest) => (guest.status === "arriving_today" ? 0 : 1);
  return guests.toSorted(
    (a, b) =>
      pinnedWeight(a) - pinnedWeight(b) ||
      bucketWeight(a) - bucketWeight(b) ||
      Number(b.vip) - Number(a.vip) ||
      guestDisplayName(a).localeCompare(guestDisplayName(b))
  );
}
