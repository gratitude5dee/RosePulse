import { describe, expect, it } from "vitest";
import { guestCrmReducer } from "@/lib/store/reducer";
import { analyzeWalkieTranscript } from "@/lib/walkie-intelligence";
import type { GuestCrmState, Ticket } from "@/lib/types";

const baseState: GuestCrmState = {
  guests: [],
  tickets: [],
  staff: [],
  preferences: [],
  recommendations: [],
  focusedGuestId: undefined,
  detailGuestId: undefined,
  focusedTicketId: undefined,
  newTicketOpen: false,
  newTicketDraft: undefined,
  unfiledNotes: [],
  backend: {
    mode: "fixtures",
    status: "idle",
    pendingActions: 0
  }
};

describe("guestCrmReducer walkie intelligence", () => {
  it("creates voice tickets with stable ids and evidence-backed preference candidates", () => {
    const transcript = "Guest has a shellfish allergy for dinner tonight and asked chef to avoid dairy.";
    const intelligence = analyzeWalkieTranscript({ transcript, guestId: "g_1" });

    const next = guestCrmReducer(baseState, {
      type: "CREATE_TICKET",
      payload: {
        ticketId: "t_known",
        createdEventId: "e_created",
        voiceNoteEventId: "e_voice",
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
        intelligence
      }
    });

    expect(next.tickets[0]?.events[0]?.id).toBe("e_voice_existing");
    expect(next.preferences.some((preference) => preference.evidenceIds.includes("e_voice_existing"))).toBe(true);
  });

  it("keeps unfiled intelligence and applies it when the note is filed to a guest", () => {
    const transcript = "Guest prefers oatmeal with oat milk and no dairy at breakfast.";
    const intelligence = analyzeWalkieTranscript({ transcript });
    const withUnfiled = guestCrmReducer(baseState, {
      type: "ADD_UNFILED_NOTE",
      payload: {
        noteId: "u_known",
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
        guestId: "g_1",
        ticketId: "t_filed",
        createdEventId: "e_created_filed",
        voiceNoteEventId: "e_voice_filed"
      }
    });

    expect(filed.tickets[0]?.id).toBe("t_filed");
    expect(filed.preferences.some((preference) => preference.evidenceIds.includes("e_voice_filed"))).toBe(true);
    expect(filed.unfiledNotes[0]?.filedAt).toBeDefined();
  });
});
