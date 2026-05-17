import { describe, expect, it } from "vitest";
import { guestCrmReducer } from "@/lib/store/reducer";
import { analyzeWalkieTranscript } from "@/lib/walkie-intelligence";
import type { GuestCrmState, Ticket } from "@/lib/types";

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

describe("guestCrmReducer walkie intelligence", () => {
  it("keeps category focus as UI-only reducer state", () => {
    const next = guestCrmReducer(baseState, {
      type: "SET_CATEGORY_FOCUS",
      payload: { category: "fnb" }
    });

    expect(next.categoryFocus).toBe("fnb");
    expect(next.tickets).toHaveLength(0);
  });

  it("creates voice tickets with stable ids and evidence-backed preference candidates", () => {
    const transcript = "Guest has a shellfish allergy for dinner tonight and asked chef to avoid dairy.";
    const intelligence = analyzeWalkieTranscript({ transcript, guestId: "g_1" });

    const next = guestCrmReducer(baseState, {
      type: "CREATE_TICKET",
      payload: {
        ticketId: "t_known",
        createdEventId: "e_created",
        voiceNoteEventId: "e_voice",
        memoId: "memo_known",
        guestId: "g_1",
        category: intelligence.category,
        priority: intelligence.priority,
        title: intelligence.title,
        detail: transcript,
        voiceNote: true,
        intelligence
      }
    });

    expect(next.tickets[0]?.id).toBe("t_known");
    expect(next.tickets[0]?.events.map((event) => event.id)).toEqual(["e_created", "e_voice"]);
    expect(next.preferences.length).toBeGreaterThan(0);
    expect(next.preferences[0]?.sourceType).toBe("voice_note");
    expect(next.preferences[0]?.evidenceIds).toContain("e_voice");
    expect(next.preferences[0]?.evidenceIds).toContain("memo_known");
    expect(next.preferenceEvidence.some((evidence) => evidence.voiceNoteMemoId === "memo_known")).toBe(true);
    expect(next.voiceMemos[0]).toMatchObject({
      id: "memo_known",
      status: "filed",
      source: "new_ticket",
      guestId: "g_1",
      ticketId: "t_known",
      ticketEventId: "e_voice"
    });
  });

  it("attaches voice notes to existing tickets and links extracted signals to the event", () => {
    const existingTicket: Ticket = {
      id: "t_existing",
      guestId: "g_1",
      category: "room",
      title: "Room setup",
      detail: "Existing request",
      priority: "medium",
      status: "open",
      createdAt: "2026-05-16T00:00:00.000Z",
      updatedAt: "2026-05-16T00:00:00.000Z",
      createdBy: "s_001",
      assignedTo: "front_desk",
      events: []
    };
    const transcript = "Guest prefers a firm mattress and quiet room away from elevator noise.";
    const intelligence = analyzeWalkieTranscript({ transcript, guestId: "g_1", ticketId: existingTicket.id });

    const next = guestCrmReducer({ ...baseState, tickets: [existingTicket] }, {
      type: "ADD_VOICE_NOTE",
      payload: {
        ticketId: existingTicket.id,
        transcript,
        eventId: "e_voice_existing",
        memoId: "memo_attached",
        intelligence
      }
    });

    expect(next.tickets[0]?.events[0]?.id).toBe("e_voice_existing");
    expect(next.preferences.some((preference) => preference.evidenceIds.includes("e_voice_existing"))).toBe(true);
    expect(next.preferenceEvidence.some((evidence) => evidence.ticketEventId === "e_voice_existing")).toBe(true);
    expect(next.voiceMemos[0]).toMatchObject({
      id: "memo_attached",
      status: "attached",
      source: "ticket_attachment",
      ticketId: existingTicket.id
    });
  });

  it("keeps unfiled intelligence and applies it when the note is filed to a guest", () => {
    const transcript = "Guest prefers oatmeal with oat milk and no dairy at breakfast.";
    const intelligence = analyzeWalkieTranscript({ transcript });
    const withUnfiled = guestCrmReducer(baseState, {
      type: "ADD_UNFILED_NOTE",
      payload: {
        noteId: "u_known",
        memoId: "memo_unfiled",
        transcript,
        category: intelligence.category,
        priority: intelligence.priority,
        intelligence
      }
    });

    const filed = guestCrmReducer(withUnfiled, {
      type: "FILE_UNFILED_NOTE",
      payload: {
        noteId: "u_known",
        memoId: "memo_unfiled",
        guestId: "g_1",
        ticketId: "t_filed",
        createdEventId: "e_created_filed",
        voiceNoteEventId: "e_voice_filed"
      }
    });

    expect(filed.tickets[0]?.id).toBe("t_filed");
    expect(filed.preferences.some((preference) => preference.evidenceIds.includes("e_voice_filed"))).toBe(true);
    expect(filed.preferenceEvidence.some((evidence) => evidence.voiceNoteMemoId === "memo_unfiled")).toBe(true);
    expect(filed.unfiledNotes[0]?.filedAt).toBeDefined();
    expect(filed.voiceMemos[0]).toMatchObject({
      id: "memo_unfiled",
      status: "filed",
      source: "filed_unfiled",
      guestId: "g_1",
      ticketId: "t_filed",
      ticketEventId: "e_voice_filed"
    });
  });

  it("deduplicates repeated voice-derived preference candidates for the same guest", () => {
    const transcript = "Guest has a shellfish allergy for dinner tonight and asked chef to avoid dairy.";
    const intelligence = analyzeWalkieTranscript({ transcript, guestId: "g_1" });
    const first = guestCrmReducer(baseState, {
      type: "CREATE_TICKET",
      payload: {
        ticketId: "t_first",
        createdEventId: "e_created_first",
        voiceNoteEventId: "e_voice_first",
        memoId: "memo_first",
        guestId: "g_1",
        category: intelligence.category,
        priority: intelligence.priority,
        title: intelligence.title,
        detail: transcript,
        voiceNote: true,
        intelligence
      }
    });
    const second = guestCrmReducer(first, {
      type: "CREATE_TICKET",
      payload: {
        ticketId: "t_second",
        createdEventId: "e_created_second",
        voiceNoteEventId: "e_voice_second",
        memoId: "memo_second",
        guestId: "g_1",
        category: intelligence.category,
        priority: intelligence.priority,
        title: intelligence.title,
        detail: transcript,
        voiceNote: true,
        intelligence
      }
    });

    expect(second.voiceMemos).toHaveLength(2);
    expect(second.preferences).toHaveLength(first.preferences.length);
  });
});
