import { describe, expect, it } from "vitest";
import {
  selectAttentionQueue,
  selectCategoryOperations,
  selectCategoryWorkItems,
  selectGuestsArrivingToday,
  selectGuestHasCategoryWork,
  selectRecentVoiceMemos,
  selectShiftHandoff
} from "@/lib/store/selectors";
import type { Guest, GuestCrmState, Ticket, VoiceNoteMemo } from "@/lib/types";

const baseState: GuestCrmState = {
  guests: [],
  tickets: [],
  staff: [],
  preferences: [],
  preferenceEvidence: [],
  recommendations: [],
  categoryFocus: "all",
  focusedGuestId: undefined,
  detailGuestId: undefined,
  focusedTicketId: undefined,
  newTicketOpen: false,
  newTicketDraft: undefined,
  unfiledNotes: [],
  voiceMemos: [],
  backend: {
    mode: "fixtures",
    status: "idle",
    pendingActions: 0
  }
};

const tickets: Ticket[] = [
  makeTicket({
    id: "t_fnb_urgent",
    guestId: "g_1",
    category: "fnb",
    priority: "urgent",
    status: "open",
    updatedAt: "2026-05-16T10:00:00.000Z"
  }),
  makeTicket({
    id: "t_fnb_resolved",
    guestId: "g_1",
    category: "fnb",
    priority: "high",
    status: "resolved",
    updatedAt: "2026-05-16T11:00:00.000Z"
  }),
  makeTicket({
    id: "t_housekeeping_blocked",
    guestId: "g_2",
    category: "housekeeping",
    priority: "high",
    status: "blocked",
    updatedAt: "2026-05-16T12:00:00.000Z"
  })
];

const voiceMemos: VoiceNoteMemo[] = [
  makeMemo({
    id: "memo_fnb_unfiled",
    category: "fnb",
    priority: "high",
    status: "unfiled",
    updatedAt: "2026-05-16T12:30:00.000Z"
  }),
  makeMemo({
    id: "memo_fnb_archived",
    category: "fnb",
    priority: "urgent",
    status: "archived",
    updatedAt: "2026-05-16T13:00:00.000Z"
  }),
  makeMemo({
    id: "memo_housekeeping",
    guestId: "g_2",
    category: "housekeeping",
    priority: "medium",
    status: "filed",
    updatedAt: "2026-05-16T09:00:00.000Z"
  })
];

describe("category operations selectors", () => {
  it("combines active tickets and voice memos while excluding resolved and archived records", () => {
    const state = { ...baseState, tickets, voiceMemos };
    const fnb = selectCategoryOperations(state).find((summary) => summary.category === "fnb");

    expect(fnb).toMatchObject({
      activeTicketCount: 1,
      activeMemoCount: 1,
      urgentCount: 1,
      highCount: 1,
      unfiledMemoCount: 1,
      totalActive: 2,
      peakPriority: "urgent"
    });
  });

  it("sorts categories and work items by operational importance", () => {
    const state = { ...baseState, tickets, voiceMemos };
    const summaries = selectCategoryOperations(state);
    const fnbWork = selectCategoryWorkItems(state, "fnb");

    expect(summaries[0]?.category).toBe("fnb");
    expect(fnbWork.map((item) => item.id)).toEqual(["t_fnb_urgent", "memo_fnb_unfiled"]);
  });

  it("detects guest category work across tickets and memos", () => {
    const state = { ...baseState, tickets, voiceMemos };

    expect(selectGuestHasCategoryWork(state, "g_1", "fnb")).toBe(true);
    expect(selectGuestHasCategoryWork(state, "g_2", "housekeeping")).toBe(true);
    expect(selectGuestHasCategoryWork(state, "g_1", "spa")).toBe(false);
    expect(selectGuestHasCategoryWork(state, "g_1", "all")).toBe(true);
  });
});

describe("operations selectors", () => {
  it("returns recent voice memos with archived records excluded", () => {
    const state = { ...baseState, voiceMemos };

    expect(selectRecentVoiceMemos(state).map((memo) => memo.id)).toEqual(["memo_fnb_unfiled", "memo_housekeeping"]);
  });

  it("builds shift handoff and attention queues from tickets, memos, and preference signals", () => {
    const preference = {
      id: "pref_high",
      guestId: "g_1",
      category: "dining" as const,
      label: "Allergy & Safety",
      detail: "Nut allergy requires F+B confirmation.",
      confidence: 0.9,
      status: "candidate" as const,
      sourceType: "voice_note" as const,
      privacySensitivity: "high" as const,
      normalizedSignalKey: "g_1|dining|allergy",
      analysisVersion: "guestpulse-v1",
      lastSeenAt: new Date().toISOString(),
      evidenceIds: ["pe_high"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const overdue = makeTicket({
      id: "t_overdue",
      guestId: "g_1",
      category: "guest_relations",
      priority: "medium",
      dueAt: new Date(Date.now() - 60_000).toISOString()
    });
    const state = { ...baseState, tickets: [...tickets, overdue], voiceMemos, preferences: [preference] };
    const handoff = selectShiftHandoff(state);
    const attention = selectAttentionQueue(state);

    expect(handoff.unfiledMemos.map((memo) => memo.id)).toContain("memo_fnb_unfiled");
    expect(handoff.newPreferences.map((item) => item.id)).toContain("pref_high");
    expect(attention[0]?.id).toBe("t_overdue");
    expect(attention.some((item) => item.type === "preference" && item.id === "pref_high")).toBe(true);
  });
});

describe("today guest ordering", () => {
  it("pins Radha first while keeping Ari in the Today roster", () => {
    const state = {
      ...baseState,
      guests: [
        makeGuest({ id: "g_0421", firstName: "Arielle", lastName: "Laurent", preferredName: "Ari", vip: true }),
        makeGuest({ id: "guest_radha_arora_demo", firstName: "Radha", lastName: "Arora", vip: true }),
        makeGuest({ id: "g_0422", firstName: "Mateo", lastName: "Varela", vip: true })
      ]
    };

    const today = selectGuestsArrivingToday(state);

    expect(today[0]?.id).toBe("guest_radha_arora_demo");
    expect(today.map((guest) => guest.id)).toContain("g_0421");
    expect(today.findIndex((guest) => guest.id === "g_0421")).toBeGreaterThan(0);
  });
});

function makeTicket(overrides: Partial<Ticket>): Ticket {
  return {
    id: "t",
    guestId: "g_1",
    category: "guest_relations",
    title: "Follow up",
    detail: "Guest follow-up.",
    priority: "medium",
    status: "open",
    createdAt: "2026-05-16T08:00:00.000Z",
    updatedAt: "2026-05-16T08:00:00.000Z",
    createdBy: "s_001",
    events: [],
    ...overrides
  };
}

function makeMemo(overrides: Partial<VoiceNoteMemo>): VoiceNoteMemo {
  return {
    id: "memo",
    transcript: "Guest memo.",
    title: "Guest memo",
    category: "guest_relations",
    priority: "medium",
    status: "filed",
    source: "new_ticket",
    routeConfidence: 0.8,
    signalCount: 1,
    preferenceCategories: [],
    analysisProvider: "deterministic",
    analysisVersion: "guestpulse-v1",
    analysisStatus: "analyzed",
    createdAt: "2026-05-16T08:00:00.000Z",
    updatedAt: "2026-05-16T08:00:00.000Z",
    ...overrides
  };
}

function makeGuest(overrides: Partial<Guest>): Guest {
  return {
    id: "guest",
    firstName: "Guest",
    lastName: "Fixture",
    loyaltyTier: "Gold",
    vip: false,
    arrivalDate: "2026-05-16",
    departureDate: "2026-05-18",
    status: "arriving_today",
    roomType: "Garden Suite",
    partySize: 1,
    languages: ["en"],
    tags: [],
    ...overrides
  };
}
