import { bumpPriority, CATEGORY_META, getEscalationTarget } from "@/lib/categories";
import { transcriptTitle } from "@/lib/format";
import { makeClientId } from "@/lib/id";
import type {
  GuestPreference,
  GuestCrmState,
  NewTicketDraft,
  StaffRole,
  Ticket,
  TicketCategory,
  TicketEvent,
  TicketPriority,
  TicketStatus,
  UnfiledVoiceNote,
  WalkieIntelligence
} from "@/lib/types";

export type GuestCrmAction =
  | {
      type: "CREATE_TICKET";
      payload: {
        guestId: string;
        category: TicketCategory;
        priority: TicketPriority;
        title: string;
        detail: string;
        assignedTo?: StaffRole;
        dueAt?: string;
        voiceNote?: boolean;
        ticketId?: string;
        createdEventId?: string;
        voiceNoteEventId?: string;
        intelligence?: WalkieIntelligence;
      };
    }
  | { type: "UPDATE_TICKET_STATUS"; payload: { ticketId: string; status: TicketStatus } }
  | { type: "ESCALATE_TICKET"; payload: { ticketId: string; note?: string } }
  | { type: "ADD_TICKET_COMMENT"; payload: { ticketId: string; body: string } }
  | {
      type: "ADD_VOICE_NOTE";
      payload: { ticketId: string; transcript: string; audioUrl?: string; eventId?: string; intelligence?: WalkieIntelligence };
    }
  | { type: "ASSIGN_TICKET"; payload: { ticketId: string; assignedTo: StaffRole } }
  | { type: "SET_PRIORITY"; payload: { ticketId: string; priority: TicketPriority } }
  | { type: "SET_FOCUSED_GUEST"; payload: { guestId?: string } }
  | { type: "OPEN_GUEST_DETAIL"; payload: { guestId: string; ticketId?: string } }
  | { type: "CLOSE_GUEST_DETAIL" }
  | { type: "OPEN_NEW_TICKET"; payload?: NewTicketDraft }
  | { type: "CLOSE_NEW_TICKET" }
  | { type: "ADD_UNFILED_NOTE"; payload: Omit<UnfiledVoiceNote, "id" | "createdAt"> & { noteId?: string } }
  | {
      type: "FILE_UNFILED_NOTE";
      payload: {
        noteId: string;
        guestId: string;
        priority?: TicketPriority;
        ticketId?: string;
        createdEventId?: string;
        voiceNoteEventId?: string;
        intelligence?: WalkieIntelligence;
      };
    }
  | { type: "SET_BACKEND_SYNC"; payload: Partial<GuestCrmState["backend"]> }
  | { type: "REPLACE_STORE"; payload: GuestCrmState };

const CURRENT_STAFF = {
  id: "s_001",
  name: "Amara Singh"
};

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix: "t" | "e" | "u" | "pref") {
  return makeClientId(prefix);
}

function makeEvent(
  ticketId: string,
  event: Omit<TicketEvent, "id" | "ticketId" | "actorId" | "actorName" | "at">,
  id = makeId("e")
): TicketEvent {
  return {
    id,
    ticketId,
    actorId: CURRENT_STAFF.id,
    actorName: CURRENT_STAFF.name,
    at: nowIso(),
    ...event
  };
}

function makeGuestPreferences(input: {
  guestId: string;
  intelligence?: WalkieIntelligence;
  evidenceIds: string[];
}): GuestPreference[] {
  if (!input.intelligence?.signals.length) return [];
  const now = nowIso();
  return input.intelligence.signals.map((signal) => ({
    id: makeId("pref"),
    guestId: input.guestId,
    category: signal.preferenceCategory,
    label: signal.label,
    detail: signal.detail,
    confidence: signal.confidence,
    status: "candidate",
    sourceType: "voice_note",
    evidenceIds: input.evidenceIds,
    createdAt: now,
    updatedAt: now
  }));
}

function updateTicket(state: GuestCrmState, ticketId: string, updater: (ticket: Ticket) => Ticket): GuestCrmState {
  return {
    ...state,
    tickets: state.tickets.map((ticket) => (ticket.id === ticketId ? updater(ticket) : ticket))
  };
}

export function guestCrmReducer(state: GuestCrmState, action: GuestCrmAction): GuestCrmState {
  switch (action.type) {
    case "CREATE_TICKET": {
      const ticketId = action.payload.ticketId ?? makeId("t");
      const createdEvent = makeEvent(ticketId, {
        type: "created",
        body: action.payload.detail
      }, action.payload.createdEventId);
      const voiceEvent = action.payload.voiceNote
        ? makeEvent(ticketId, {
            type: "voice_note",
            body: action.payload.detail
          }, action.payload.voiceNoteEventId)
        : undefined;
      const ticket: Ticket = {
        id: ticketId,
        guestId: action.payload.guestId,
        category: action.payload.category,
        title: action.payload.title,
        detail: action.payload.detail,
        priority: action.payload.priority,
        status: "open",
        createdAt: nowIso(),
        updatedAt: nowIso(),
        createdBy: CURRENT_STAFF.id,
        assignedTo: action.payload.assignedTo ?? CATEGORY_META[action.payload.category].leadRole,
        dueAt: action.payload.dueAt,
        events: voiceEvent ? [createdEvent, voiceEvent] : [createdEvent]
      };
      const preferences = makeGuestPreferences({
        guestId: action.payload.guestId,
        intelligence: action.payload.intelligence,
        evidenceIds: [voiceEvent?.id ?? createdEvent.id]
      });
      return {
        ...state,
        tickets: [ticket, ...state.tickets],
        preferences: [...preferences, ...state.preferences],
        newTicketOpen: false,
        newTicketDraft: undefined
      };
    }
    case "UPDATE_TICKET_STATUS":
      return updateTicket(state, action.payload.ticketId, (ticket) => ({
        ...ticket,
        status: action.payload.status,
        updatedAt: nowIso(),
        events: [
          ...ticket.events,
          makeEvent(ticket.id, {
            type: "status_changed",
            fromStatus: ticket.status,
            toStatus: action.payload.status,
            body: `Status changed to ${action.payload.status}.`
          })
        ]
      }));
    case "ESCALATE_TICKET":
      return updateTicket(state, action.payload.ticketId, (ticket) => {
        const escalatedTo = getEscalationTarget(ticket.assignedTo);
        return {
          ...ticket,
          status: "escalated",
          priority: bumpPriority(ticket.priority),
          updatedAt: nowIso(),
          events: [
            ...ticket.events,
            makeEvent(ticket.id, {
              type: "escalated",
              escalatedTo,
              body: action.payload.note || "Escalated for leadership attention."
            })
          ]
        };
      });
    case "ADD_TICKET_COMMENT":
      return updateTicket(state, action.payload.ticketId, (ticket) => ({
        ...ticket,
        updatedAt: nowIso(),
        events: [
          ...ticket.events,
          makeEvent(ticket.id, {
            type: "comment",
            body: action.payload.body
          })
        ]
      }));
    case "ADD_VOICE_NOTE": {
      let preferences: GuestPreference[] = [];
      const nextState = updateTicket(state, action.payload.ticketId, (ticket) => {
        const event = makeEvent(
          ticket.id,
          {
            type: "voice_note",
            body: action.payload.transcript,
            audioUrl: action.payload.audioUrl
          },
          action.payload.eventId
        );
        preferences = makeGuestPreferences({
          guestId: ticket.guestId,
          intelligence: action.payload.intelligence,
          evidenceIds: [event.id]
        });
        return {
          ...ticket,
          updatedAt: nowIso(),
          events: [...ticket.events, event]
        };
      });
      return preferences.length > 0 ? { ...nextState, preferences: [...preferences, ...nextState.preferences] } : nextState;
    }
    case "ASSIGN_TICKET":
      return updateTicket(state, action.payload.ticketId, (ticket) => ({
        ...ticket,
        assignedTo: action.payload.assignedTo,
        updatedAt: nowIso(),
        events: [
          ...ticket.events,
          makeEvent(ticket.id, {
            type: "assigned",
            body: `Assigned to ${action.payload.assignedTo}.`
          })
        ]
      }));
    case "SET_PRIORITY":
      return updateTicket(state, action.payload.ticketId, (ticket) => ({
        ...ticket,
        priority: action.payload.priority,
        updatedAt: nowIso()
      }));
    case "SET_FOCUSED_GUEST":
      return { ...state, focusedGuestId: action.payload.guestId };
    case "OPEN_GUEST_DETAIL":
      return {
        ...state,
        detailGuestId: action.payload.guestId,
        focusedGuestId: action.payload.guestId,
        focusedTicketId: action.payload.ticketId
      };
    case "CLOSE_GUEST_DETAIL":
      return { ...state, detailGuestId: undefined, focusedTicketId: undefined };
    case "OPEN_NEW_TICKET":
      return { ...state, newTicketOpen: true, newTicketDraft: action.payload };
    case "CLOSE_NEW_TICKET":
      return { ...state, newTicketOpen: false, newTicketDraft: undefined };
    case "ADD_UNFILED_NOTE":
      return {
        ...state,
        unfiledNotes: [
          {
            id: action.payload.noteId ?? makeId("u"),
            createdAt: nowIso(),
            ...action.payload
          },
          ...state.unfiledNotes
        ]
      };
    case "FILE_UNFILED_NOTE": {
      const note = state.unfiledNotes.find((item) => item.id === action.payload.noteId);
      if (!note) return state;
      const ticketId = action.payload.ticketId ?? makeId("t");
      const createdEvent = makeEvent(
        ticketId,
        {
          type: "created",
          body: note.transcript
        },
        action.payload.createdEventId
      );
      const voiceEvent = makeEvent(
        ticketId,
        {
          type: "voice_note",
          body: note.transcript
        },
        action.payload.voiceNoteEventId
      );
      const ticket: Ticket = {
        id: ticketId,
        guestId: action.payload.guestId,
        category: note.category,
        title: transcriptTitle(note.transcript),
        detail: note.transcript,
        priority: action.payload.priority ?? note.priority,
        status: "open",
        createdAt: nowIso(),
        updatedAt: nowIso(),
        createdBy: CURRENT_STAFF.id,
        assignedTo: CATEGORY_META[note.category].leadRole,
        events: [createdEvent, voiceEvent]
      };
      const preferences = makeGuestPreferences({
        guestId: action.payload.guestId,
        intelligence: action.payload.intelligence ?? note.intelligence,
        evidenceIds: [voiceEvent.id]
      });
      return {
        ...state,
        tickets: [ticket, ...state.tickets],
        preferences: [...preferences, ...state.preferences],
        unfiledNotes: state.unfiledNotes.map((item) =>
          item.id === note.id
            ? {
                ...item,
                guestId: action.payload.guestId,
                filedAt: nowIso(),
                filedBy: CURRENT_STAFF.id
              }
            : item
        )
      };
    }
    case "SET_BACKEND_SYNC":
      return {
        ...state,
        backend: {
          ...state.backend,
          ...action.payload
        }
      };
    case "REPLACE_STORE":
      return action.payload;
    default:
      return state;
  }
}
