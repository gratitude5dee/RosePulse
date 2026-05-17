import { bumpPriority, CATEGORY_META, getEscalationTarget } from "@/lib/categories";
import { transcriptTitle } from "@/lib/format";
import { makeClientId } from "@/lib/id";
import type {
  GuestPreferenceEvidence,
  GuestPreference,
  GuestCrmState,
  NewTicketDraft,
  PreferenceCategory,
  PreferenceStatus,
  StaffRole,
  CategoryFocus,
  Ticket,
  TicketCategory,
  TicketEvent,
  TicketPriority,
  TicketStatus,
  UnfiledVoiceNote,
  VoiceMemoMetadata,
  VoiceNoteMemo,
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
        memoId?: string;
        intelligence?: WalkieIntelligence;
        memoMetadata?: VoiceMemoMetadata;
      };
    }
  | { type: "UPDATE_TICKET_STATUS"; payload: { ticketId: string; status: TicketStatus } }
  | { type: "ESCALATE_TICKET"; payload: { ticketId: string; note?: string } }
  | { type: "ADD_TICKET_COMMENT"; payload: { ticketId: string; body: string } }
  | {
      type: "ADD_VOICE_NOTE";
      payload: {
        ticketId: string;
        transcript: string;
        audioUrl?: string;
        eventId?: string;
        memoId?: string;
        intelligence?: WalkieIntelligence;
        memoMetadata?: VoiceMemoMetadata;
      };
    }
  | { type: "ASSIGN_TICKET"; payload: { ticketId: string; assignedTo: StaffRole } }
  | { type: "SET_PRIORITY"; payload: { ticketId: string; priority: TicketPriority } }
  | { type: "SET_CATEGORY_FOCUS"; payload: { category: CategoryFocus } }
  | { type: "SET_FOCUSED_GUEST"; payload: { guestId?: string } }
  | { type: "OPEN_GUEST_DETAIL"; payload: { guestId: string; ticketId?: string } }
  | { type: "CLOSE_GUEST_DETAIL" }
  | { type: "OPEN_NEW_TICKET"; payload?: NewTicketDraft }
  | { type: "CLOSE_NEW_TICKET" }
  | { type: "ADD_UNFILED_NOTE"; payload: Omit<UnfiledVoiceNote, "id" | "createdAt"> & { noteId?: string; memoId?: string; memoMetadata?: VoiceMemoMetadata } }
  | {
      type: "FILE_UNFILED_NOTE";
      payload: {
        noteId: string;
        guestId: string;
        priority?: TicketPriority;
        ticketId?: string;
        createdEventId?: string;
        voiceNoteEventId?: string;
        memoId?: string;
        intelligence?: WalkieIntelligence;
        memoMetadata?: VoiceMemoMetadata;
      };
    }
  | { type: "RESOLVE_GUEST_PREFERENCE"; payload: { preferenceId: string; status: Exclude<PreferenceStatus, "candidate">; note?: string } }
  | { type: "SET_BACKEND_SYNC"; payload: Partial<GuestCrmState["backend"]> }
  | { type: "REPLACE_STORE"; payload: GuestCrmState };

const CURRENT_STAFF = {
  id: "s_001",
  name: "Amara Singh"
};

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix: "t" | "e" | "u" | "pref" | "memo" | "pe") {
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

function makeGuestPreferenceArtifacts(input: {
  guestId: string;
  intelligence?: WalkieIntelligence;
  evidenceIds: string[];
  ticketId?: string;
  ticketEventId?: string;
  unfiledVoiceNoteId?: string;
  voiceNoteMemoId?: string;
}): { preferences: GuestPreference[]; evidence: GuestPreferenceEvidence[] } {
  if (!input.intelligence?.signals.length) return { preferences: [], evidence: [] };
  const now = nowIso();
  const preferences: GuestPreference[] = [];
  const evidence: GuestPreferenceEvidence[] = [];
  for (const signal of input.intelligence.signals) {
    const preferenceId = makeId("pref");
    const evidenceId = makeId("pe");
    const normalizedSignalKey = preferenceKey({
      guestId: input.guestId,
      category: signal.preferenceCategory,
      label: signal.label,
      detail: signal.detail
    });
    preferences.push({
      id: preferenceId,
      guestId: input.guestId,
      category: signal.preferenceCategory,
      label: signal.label,
      detail: signal.detail,
      confidence: signal.confidence,
      status: "candidate",
      sourceType: "voice_note",
      privacySensitivity: signal.privacySensitivity,
      normalizedSignalKey,
      analysisVersion: input.intelligence.schemaVersion,
      lastSeenAt: now,
      evidenceIds: [...input.evidenceIds, evidenceId],
      createdAt: now,
      updatedAt: now
    });
    evidence.push({
      id: evidenceId,
      preferenceId,
      ticketId: input.ticketId,
      ticketEventId: input.ticketEventId,
      unfiledVoiceNoteId: input.unfiledVoiceNoteId,
      voiceNoteMemoId: input.voiceNoteMemoId,
      quote: signal.evidence,
      confidence: signal.confidence,
      privacySensitivity: signal.privacySensitivity,
      analysisVersion: input.intelligence.schemaVersion,
      createdAt: now
    });
  }
  return { preferences, evidence };
}

function makeVoiceMemo(input: {
  id?: string;
  transcript: string;
  category: TicketCategory;
  priority: TicketPriority;
  source: VoiceNoteMemo["source"];
  status: VoiceNoteMemo["status"];
  guestId?: string;
  ticketId?: string;
  ticketEventId?: string;
  unfiledVoiceNoteId?: string;
  intelligence?: WalkieIntelligence;
  metadata?: VoiceMemoMetadata;
  createdAt?: string;
  filedAt?: string;
}): VoiceNoteMemo {
  const createdAt = input.createdAt ?? nowIso();
  const preferenceCategories = uniquePreferenceCategories(input.intelligence?.signals.map((signal) => signal.preferenceCategory) ?? []);
  return {
    id: input.id ?? makeId("memo"),
    transcript: input.transcript,
    title: input.intelligence?.title || transcriptTitle(input.transcript),
    category: input.category,
    priority: input.priority,
    status: input.status,
    source: input.source,
    routeConfidence: input.intelligence?.routeConfidence ?? 0.5,
    signalCount: input.intelligence?.signals.length ?? 0,
    preferenceCategories,
    createdAt,
    updatedAt: nowIso(),
    analysisProvider: input.metadata?.analysisProvider ?? input.intelligence?.provider ?? "deterministic",
    analysisModel: input.metadata?.analysisModel ?? input.intelligence?.model,
    analysisVersion: input.metadata?.analysisVersion ?? input.intelligence?.schemaVersion ?? "guestpulse-v1",
    analysisStatus: input.metadata?.analysisStatus ?? input.intelligence?.analysisStatus ?? "analyzed",
    analysisError: input.metadata?.analysisError ?? input.intelligence?.analysisError,
    transcriptionModel: input.metadata?.transcriptionModel,
    durationSeconds: input.metadata?.durationSeconds,
    transcribedAt: input.metadata?.transcribedAt,
    guestId: input.guestId,
    ticketId: input.ticketId,
    ticketEventId: input.ticketEventId,
    unfiledVoiceNoteId: input.unfiledVoiceNoteId,
    createdBy: CURRENT_STAFF.id,
    filedAt: input.filedAt,
    intelligence: input.intelligence
  };
}

function uniquePreferenceCategories(categories: PreferenceCategory[]) {
  return Array.from(new Set(categories));
}

function preferenceKey(preference: Pick<GuestPreference, "guestId" | "category" | "label" | "detail">) {
  return [preference.guestId, preference.category, preference.label, preference.detail]
    .join("|")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function mergePreferenceArtifacts(
  existingPreferences: GuestPreference[],
  existingEvidence: GuestPreferenceEvidence[],
  incomingPreferences: GuestPreference[],
  incomingEvidence: GuestPreferenceEvidence[]
) {
  if (incomingPreferences.length === 0) {
    return { preferences: existingPreferences, evidence: existingEvidence };
  }
  const byKey = new Map(existingPreferences.map((preference) => [preferenceKey(preference), preference]));
  const nextPreferences = [...existingPreferences];
  const nextEvidence = [...existingEvidence];

  for (const preference of incomingPreferences) {
    const key = preferenceKey(preference);
    const existing = byKey.get(key);
    const evidenceForPreference = incomingEvidence.filter((evidence) => evidence.preferenceId === preference.id);
    if (existing) {
      const remappedEvidence = evidenceForPreference.map((evidence) => ({ ...evidence, preferenceId: existing.id }));
      nextEvidence.push(...dedupeEvidence(nextEvidence, remappedEvidence));
      const evidenceIds = Array.from(new Set([...existing.evidenceIds, ...remappedEvidence.map((evidence) => evidence.id)]));
      const index = nextPreferences.findIndex((item) => item.id === existing.id);
      nextPreferences[index] = {
        ...existing,
        confidence: Math.max(existing.confidence, preference.confidence),
        lastSeenAt: preference.lastSeenAt,
        updatedAt: preference.updatedAt,
        evidenceIds
      };
    } else {
      byKey.set(key, preference);
      nextPreferences.unshift(preference);
      nextEvidence.push(...evidenceForPreference);
    }
  }

  return { preferences: nextPreferences, evidence: nextEvidence };
}

function dedupeEvidence(existing: GuestPreferenceEvidence[], incoming: GuestPreferenceEvidence[]) {
  const seen = new Set(
    existing.map((evidence) =>
      [evidence.preferenceId, evidence.ticketEventId, evidence.voiceNoteMemoId, evidence.unfiledVoiceNoteId, evidence.quote].join("|")
    )
  );
  return incoming.filter((evidence) => {
    const key = [evidence.preferenceId, evidence.ticketEventId, evidence.voiceNoteMemoId, evidence.unfiledVoiceNoteId, evidence.quote].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
      const memo = voiceEvent
        ? makeVoiceMemo({
            id: action.payload.memoId,
            transcript: action.payload.detail,
            category: action.payload.category,
            priority: action.payload.priority,
            source: "new_ticket",
            status: "filed",
            guestId: action.payload.guestId,
            ticketId,
            ticketEventId: voiceEvent.id,
            intelligence: action.payload.intelligence,
            metadata: action.payload.memoMetadata
          })
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
      const preferenceArtifacts = makeGuestPreferenceArtifacts({
        guestId: action.payload.guestId,
        intelligence: action.payload.intelligence,
        evidenceIds: [voiceEvent?.id ?? createdEvent.id, memo?.id].filter((id): id is string => Boolean(id)),
        ticketId,
        ticketEventId: voiceEvent?.id ?? createdEvent.id,
        voiceNoteMemoId: memo?.id
      });
      const merged = mergePreferenceArtifacts(
        state.preferences,
        state.preferenceEvidence,
        preferenceArtifacts.preferences,
        preferenceArtifacts.evidence
      );
      return {
        ...state,
        tickets: [ticket, ...state.tickets],
        preferences: merged.preferences,
        preferenceEvidence: merged.evidence,
        voiceMemos: memo ? [memo, ...state.voiceMemos] : state.voiceMemos,
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
      const ticket = state.tickets.find((item) => item.id === action.payload.ticketId);
      if (!ticket) return state;
      const event = makeEvent(
        ticket.id,
        {
          type: "voice_note",
          body: action.payload.transcript,
          audioUrl: action.payload.audioUrl
        },
        action.payload.eventId
      );
      const memo = makeVoiceMemo({
        id: action.payload.memoId,
        transcript: action.payload.transcript,
        category: action.payload.intelligence?.category ?? ticket.category,
        priority: action.payload.intelligence?.priority ?? ticket.priority,
        source: "ticket_attachment",
        status: "attached",
        guestId: ticket.guestId,
        ticketId: ticket.id,
        ticketEventId: event.id,
        intelligence: action.payload.intelligence,
        metadata: action.payload.memoMetadata
      });
      const preferenceArtifacts = makeGuestPreferenceArtifacts({
        guestId: ticket.guestId,
        intelligence: action.payload.intelligence,
        evidenceIds: [event.id, memo.id],
        ticketId: ticket.id,
        ticketEventId: event.id,
        voiceNoteMemoId: memo.id
      });
      const merged = mergePreferenceArtifacts(
        state.preferences,
        state.preferenceEvidence,
        preferenceArtifacts.preferences,
        preferenceArtifacts.evidence
      );
      return {
        ...state,
        tickets: state.tickets.map((item) =>
          item.id === ticket.id
            ? {
                ...item,
                updatedAt: nowIso(),
                events: [...item.events, event]
              }
            : item
        ),
        voiceMemos: [memo, ...state.voiceMemos],
        preferences: merged.preferences,
        preferenceEvidence: merged.evidence
      };
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
    case "SET_CATEGORY_FOCUS":
      return { ...state, categoryFocus: action.payload.category };
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
    case "ADD_UNFILED_NOTE": {
      const noteId = action.payload.noteId ?? makeId("u");
      const createdAt = nowIso();
      const memo = makeVoiceMemo({
        id: action.payload.memoId,
        transcript: action.payload.transcript,
        category: action.payload.category,
        priority: action.payload.priority,
        source: "unfiled",
        status: "unfiled",
        unfiledVoiceNoteId: noteId,
        intelligence: action.payload.intelligence,
        metadata: action.payload.memoMetadata,
        createdAt
      });
      return {
        ...state,
        unfiledNotes: [
          {
            id: noteId,
            createdAt,
            transcript: action.payload.transcript,
            category: action.payload.category,
            priority: action.payload.priority,
            intelligence: action.payload.intelligence,
            guestId: action.payload.guestId,
            ticketId: action.payload.ticketId,
            filedAt: action.payload.filedAt,
            filedBy: action.payload.filedBy
          },
          ...state.unfiledNotes
        ],
        voiceMemos: [memo, ...state.voiceMemos]
      };
    }
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
      const filedAt = nowIso();
      const existingMemo = state.voiceMemos.find(
        (memo) => memo.id === action.payload.memoId || memo.unfiledVoiceNoteId === note.id
      );
      const filedMemo: VoiceNoteMemo = existingMemo
        ? {
            ...existingMemo,
            status: "filed",
            source: "filed_unfiled",
            guestId: action.payload.guestId,
            ticketId,
            ticketEventId: voiceEvent.id,
            filedAt,
            updatedAt: filedAt,
            analysisProvider: action.payload.memoMetadata?.analysisProvider ?? existingMemo.analysisProvider,
            analysisModel: action.payload.memoMetadata?.analysisModel ?? existingMemo.analysisModel,
            analysisVersion: action.payload.memoMetadata?.analysisVersion ?? existingMemo.analysisVersion,
            analysisStatus: action.payload.memoMetadata?.analysisStatus ?? existingMemo.analysisStatus,
            analysisError: action.payload.memoMetadata?.analysisError ?? existingMemo.analysisError,
            transcriptionModel: action.payload.memoMetadata?.transcriptionModel ?? existingMemo.transcriptionModel,
            durationSeconds: action.payload.memoMetadata?.durationSeconds ?? existingMemo.durationSeconds,
            transcribedAt: action.payload.memoMetadata?.transcribedAt ?? existingMemo.transcribedAt,
            intelligence: action.payload.intelligence ?? note.intelligence ?? existingMemo.intelligence
          }
        : makeVoiceMemo({
            id: action.payload.memoId,
            transcript: note.transcript,
            category: note.category,
            priority: action.payload.priority ?? note.priority,
            source: "filed_unfiled",
            status: "filed",
            guestId: action.payload.guestId,
            ticketId,
            ticketEventId: voiceEvent.id,
            unfiledVoiceNoteId: note.id,
            intelligence: action.payload.intelligence ?? note.intelligence,
            metadata: action.payload.memoMetadata,
            filedAt
          });
      const preferenceArtifacts = makeGuestPreferenceArtifacts({
        guestId: action.payload.guestId,
        intelligence: action.payload.intelligence ?? note.intelligence,
        evidenceIds: [voiceEvent.id, filedMemo.id],
        ticketId,
        ticketEventId: voiceEvent.id,
        unfiledVoiceNoteId: note.id,
        voiceNoteMemoId: filedMemo.id
      });
      const merged = mergePreferenceArtifacts(
        state.preferences,
        state.preferenceEvidence,
        preferenceArtifacts.preferences,
        preferenceArtifacts.evidence
      );
      return {
        ...state,
        tickets: [ticket, ...state.tickets],
        preferences: merged.preferences,
        preferenceEvidence: merged.evidence,
        voiceMemos: existingMemo
          ? state.voiceMemos.map((memo) => (memo.id === existingMemo.id ? filedMemo : memo))
          : [filedMemo, ...state.voiceMemos],
        unfiledNotes: state.unfiledNotes.map((item) =>
          item.id === note.id
            ? {
                ...item,
                guestId: action.payload.guestId,
                filedAt,
                filedBy: CURRENT_STAFF.id
              }
            : item
        )
      };
    }
    case "RESOLVE_GUEST_PREFERENCE":
      return {
        ...state,
        preferences: state.preferences.map((preference) =>
          preference.id === action.payload.preferenceId
            ? {
                ...preference,
                status: action.payload.status,
                reviewNote: action.payload.note,
                resolvedBy: CURRENT_STAFF.id,
                resolvedAt: nowIso(),
                updatedAt: nowIso()
              }
            : preference
        )
      };
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
