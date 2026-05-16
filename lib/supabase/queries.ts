"use client";

import { bumpPriority, CATEGORY_META, getEscalationTarget } from "@/lib/categories";
import { transcriptTitle } from "@/lib/format";
import { makeClientId } from "@/lib/id";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { ROSEPULSE_PROPERTY_ID } from "@/lib/supabase/config";
import type { Inserts, Json, Updates } from "@/lib/supabase/database.types";
import { mapRemoteRowsToState } from "@/lib/supabase/mappers";
import type { RemoteCrmRows } from "@/lib/supabase/mappers";
import type { GuestCrmAction } from "@/lib/store/reducer";
import { analyzeWalkieTranscript } from "@/lib/walkie-intelligence";
import type { GuestCrmState, StaffRole, TicketCategory, TicketEvent, TicketPriority, TicketStatus, WalkieIntelligence } from "@/lib/types";

const CURRENT_STAFF = {
  id: "s_001",
  name: "Amara Singh"
};

export async function loadGuestCrmState(fallback: GuestCrmState) {
  const supabase = getBrowserSupabase();
  const propertyId = ROSEPULSE_PROPERTY_ID;

  const [
    guests,
    stays,
    tags,
    notes,
    staff,
    tickets,
    events,
    unfiledNotes,
    voiceMemos,
    preferences,
    preferenceEvidence,
    recommendations
  ] = await Promise.all([
    supabase.from("guests").select("*").eq("property_id", propertyId).is("archived_at", null),
    supabase.from("guest_stays").select("*").eq("property_id", propertyId).is("archived_at", null),
    supabase.from("guest_tags").select("*").eq("property_id", propertyId),
    supabase.from("guest_notes").select("*").eq("property_id", propertyId).is("archived_at", null),
    supabase.from("staff_profiles").select("*"),
    supabase.from("tickets").select("*").eq("property_id", propertyId).is("archived_at", null),
    supabase.from("ticket_events").select("*").eq("property_id", propertyId),
    supabase.from("unfiled_voice_notes").select("*").eq("property_id", propertyId).is("filed_at", null),
    supabase.from("voice_note_memos").select("*").eq("property_id", propertyId).is("archived_at", null),
    supabase.from("guest_preferences").select("*").eq("property_id", propertyId),
    supabase.from("guest_preference_evidence").select("*").eq("property_id", propertyId),
    supabase.from("preference_recommendations").select("*").eq("property_id", propertyId)
  ]);

  for (const result of [guests, stays, tags, notes, staff, tickets, events, unfiledNotes, voiceMemos, preferences, preferenceEvidence, recommendations]) {
    if (result.error) throw result.error;
  }

  const rows: RemoteCrmRows = {
    guests: guests.data ?? [],
    stays: stays.data ?? [],
    tags: tags.data ?? [],
    notes: notes.data ?? [],
    staff: staff.data ?? [],
    tickets: tickets.data ?? [],
    events: events.data ?? [],
    unfiledNotes: unfiledNotes.data ?? [],
    voiceMemos: voiceMemos.data ?? [],
    preferences: preferences.data ?? [],
    preferenceEvidence: preferenceEvidence.data ?? [],
    recommendations: recommendations.data ?? []
  };

  return mapRemoteRowsToState(rows, fallback);
}

export function persistGuestCrmAction(action: GuestCrmAction, state: GuestCrmState): Promise<void> | undefined {
  switch (action.type) {
    case "CREATE_TICKET":
      if (action.payload.voiceNote) return saveWalkieVoiceMemo({
        source: "new_ticket",
        status: "filed",
        memoId: action.payload.memoId,
        ticketId: action.payload.ticketId,
        createdEventId: action.payload.createdEventId,
        voiceNoteEventId: action.payload.voiceNoteEventId,
        guestId: action.payload.guestId,
        transcript: action.payload.detail,
        title: action.payload.title,
        category: action.payload.category,
        priority: action.payload.priority,
        intelligence: action.payload.intelligence
      });
      return createTicket(action.payload);
    case "UPDATE_TICKET_STATUS":
      return updateTicketStatus(action.payload.ticketId, action.payload.status, state);
    case "ESCALATE_TICKET":
      return escalateTicket(action.payload.ticketId, action.payload.note, state);
    case "ADD_TICKET_COMMENT":
      return addTicketComment(action.payload.ticketId, action.payload.body);
    case "ADD_VOICE_NOTE":
      return saveWalkieVoiceMemo({
        source: "ticket_attachment",
        status: "attached",
        memoId: action.payload.memoId,
        ticketId: action.payload.ticketId,
        voiceNoteEventId: action.payload.eventId,
        transcript: action.payload.transcript,
        category: action.payload.intelligence?.category ?? state.tickets.find((ticket) => ticket.id === action.payload.ticketId)?.category ?? "guest_relations",
        priority: action.payload.intelligence?.priority ?? state.tickets.find((ticket) => ticket.id === action.payload.ticketId)?.priority ?? "medium",
        intelligence: action.payload.intelligence
      });
    case "ASSIGN_TICKET":
      return assignTicket(action.payload.ticketId, action.payload.assignedTo);
    case "SET_PRIORITY":
      return setPriority(action.payload.ticketId, action.payload.priority);
    case "ADD_UNFILED_NOTE":
      return saveWalkieVoiceMemo({
        source: "unfiled",
        status: "unfiled",
        memoId: action.payload.memoId,
        noteId: action.payload.noteId,
        transcript: action.payload.transcript,
        category: action.payload.category,
        priority: action.payload.priority,
        intelligence: action.payload.intelligence
      });
    case "FILE_UNFILED_NOTE":
      return saveWalkieVoiceMemoFromUnfiled(action.payload, state);
    default:
      return undefined;
  }
}

interface SaveWalkieVoiceMemoInput {
  source: "unfiled" | "new_ticket" | "ticket_attachment" | "filed_unfiled";
  status: "unfiled" | "filed" | "attached";
  memoId?: string;
  noteId?: string;
  ticketId?: string;
  createdEventId?: string;
  voiceNoteEventId?: string;
  guestId?: string;
  transcript: string;
  title?: string;
  category: TicketCategory;
  priority: TicketPriority;
  intelligence?: WalkieIntelligence;
}

async function saveWalkieVoiceMemo(input: SaveWalkieVoiceMemoInput) {
  const supabase = getBrowserSupabase();
  const payload = buildVoiceMemoRpcPayload(input);
  const { error } = await supabase.rpc("save_walkie_voice_memo", { p_payload: payload });
  if (error) throw error;
}

async function saveWalkieVoiceMemoFromUnfiled(
  payload: Extract<GuestCrmAction, { type: "FILE_UNFILED_NOTE" }>["payload"],
  state: GuestCrmState
) {
  const note = state.unfiledNotes.find((item) => item.id === payload.noteId);
  if (!note) throw new Error("Unfiled note not found");
  const memo = state.voiceMemos.find((item) => item.id === payload.memoId || item.unfiledVoiceNoteId === payload.noteId);
  await saveWalkieVoiceMemo({
    source: "filed_unfiled",
    status: "filed",
    memoId: payload.memoId ?? memo?.id,
    noteId: payload.noteId,
    ticketId: payload.ticketId,
    createdEventId: payload.createdEventId,
    voiceNoteEventId: payload.voiceNoteEventId,
    guestId: payload.guestId,
    transcript: note.transcript,
    title: memo?.title ?? transcriptTitle(note.transcript),
    category: note.category,
    priority: payload.priority ?? note.priority,
    intelligence:
      payload.intelligence ??
      note.intelligence ??
      memo?.intelligence ??
      analyzeWalkieTranscript({
        transcript: note.transcript,
        guestId: payload.guestId
      })
  });
}

function buildVoiceMemoRpcPayload(input: SaveWalkieVoiceMemoInput): Json {
  const intelligence = input.intelligence;
  const signals = intelligence?.signals ?? [];
  const preferenceCategories = Array.from(new Set(signals.map((signal) => signal.preferenceCategory)));
  return {
    propertyId: ROSEPULSE_PROPERTY_ID,
    source: input.source,
    status: input.status,
    memoId: input.memoId ?? makeId("memo"),
    noteId: input.noteId,
    ticketId: input.ticketId,
    createdEventId: input.createdEventId,
    voiceNoteEventId: input.voiceNoteEventId,
    guestId: input.guestId,
    transcript: input.transcript,
    title: input.title ?? intelligence?.title ?? transcriptTitle(input.transcript),
    category: input.category,
    priority: input.priority,
    routeConfidence: intelligence?.routeConfidence ?? 0.5,
    preferenceCategories,
    intelligence: intelligence ? (intelligence as unknown as Json) : {},
    signals: signals.map((signal) => ({
      id: signal.id,
      preferenceCategory: signal.preferenceCategory,
      label: signal.label,
      detail: signal.detail,
      value: signal.value,
      evidence: signal.evidence,
      confidence: signal.confidence,
      privacySensitivity: signal.privacySensitivity,
      sourceRecordIds: signal.sourceRecordIds
    }))
  };
}

async function createTicket(payload: Extract<GuestCrmAction, { type: "CREATE_TICKET" }>["payload"]) {
  const ticketId = payload.ticketId ?? makeId("t");
  const ticket: Inserts<"tickets"> = {
    id: ticketId,
    property_id: ROSEPULSE_PROPERTY_ID,
    guest_id: payload.guestId,
    category: payload.category,
    title: payload.title,
    detail: payload.detail,
    priority: payload.priority,
    status: "open",
    created_by: CURRENT_STAFF.id,
    assigned_to_role: payload.assignedTo ?? CATEGORY_META[payload.category].leadRole,
    due_at: payload.dueAt ?? null
  };

  await insertTicket(ticket);
  const createdEventId = await insertEvent({
    eventId: payload.createdEventId,
    ticketId,
    type: "created",
    body: payload.detail
  });
  let voiceNoteEventId: string | undefined;
  if (payload.voiceNote) {
    voiceNoteEventId = await insertEvent({
      eventId: payload.voiceNoteEventId,
      ticketId,
      type: "voice_note",
      body: payload.detail
    });
  }
  await persistPreferenceCandidates({
    guestId: payload.guestId,
    ticketId,
    ticketEventId: voiceNoteEventId ?? createdEventId,
    intelligence: payload.intelligence
  });
}

async function updateTicketStatus(ticketId: string, status: TicketStatus, state: GuestCrmState) {
  const ticket = state.tickets.find((item) => item.id === ticketId);
  await updateTicket(ticketId, { status, updated_at: nowIso() });
  await insertEvent({
    ticketId,
    type: "status_changed",
    fromStatus: ticket?.status,
    toStatus: status,
    body: `Status changed to ${status}.`
  });
}

async function escalateTicket(ticketId: string, note: string | undefined, state: GuestCrmState) {
  const ticket = state.tickets.find((item) => item.id === ticketId);
  if (!ticket) throw new Error("Ticket not found for escalation");

  const escalatedTo = getEscalationTarget(ticket.assignedTo);
  await updateTicket(ticketId, {
    status: "escalated",
    priority: bumpPriority(ticket.priority),
    updated_at: nowIso()
  });
  await insertEvent({
    ticketId,
    type: "escalated",
    escalatedTo,
    body: note || "Escalated for leadership attention."
  });
}

async function addTicketComment(ticketId: string, body: string) {
  await updateTicket(ticketId, { updated_at: nowIso() });
  await insertEvent({
    ticketId,
    type: "comment",
    body
  });
}

async function assignTicket(ticketId: string, assignedTo: StaffRole) {
  await updateTicket(ticketId, {
    assigned_to_role: assignedTo,
    updated_at: nowIso()
  });
  await insertEvent({
    ticketId,
    type: "assigned",
    body: `Assigned to ${assignedTo}.`
  });
}

async function setPriority(ticketId: string, priority: TicketPriority) {
  await updateTicket(ticketId, {
    priority,
    updated_at: nowIso()
  });
}

async function updateTicket(ticketId: string, patch: Updates<"tickets">) {
  const supabase = getBrowserSupabase();
  const { error } = await supabase
    .from("tickets")
    .update(patch)
    .eq("id", ticketId)
    .eq("property_id", ROSEPULSE_PROPERTY_ID);
  if (error) throw error;
}

async function insertEvent(input: {
  eventId?: string;
  ticketId: string;
  type: TicketEvent["type"];
  body?: string;
  audioUrl?: string;
  fromStatus?: TicketStatus;
  toStatus?: TicketStatus;
  escalatedTo?: StaffRole;
}) {
  const eventId = input.eventId ?? makeId("e");
  await insertTicketEvent({
    id: eventId,
    property_id: ROSEPULSE_PROPERTY_ID,
    ticket_id: input.ticketId,
    type: input.type,
    actor_id: CURRENT_STAFF.id,
    actor_name: CURRENT_STAFF.name,
    body: input.body ?? null,
    audio_url: input.audioUrl ?? null,
    from_status: input.fromStatus ?? null,
    to_status: input.toStatus ?? null,
    escalated_to: input.escalatedTo ?? null
  });
  return eventId;
}

async function insertTicket(row: Inserts<"tickets">) {
  const supabase = getBrowserSupabase();
  const { error } = await supabase.from("tickets").insert(row);
  if (error) throw error;
}

async function insertTicketEvent(row: Inserts<"ticket_events">) {
  const supabase = getBrowserSupabase();
  const { error } = await supabase.from("ticket_events").insert(row);
  if (error) throw error;
}

async function persistPreferenceCandidates(input: {
  guestId: string;
  ticketId: string;
  ticketEventId: string;
  intelligence?: WalkieIntelligence;
}) {
  if (!input.intelligence?.signals.length) return;

  const supabase = getBrowserSupabase();
  for (const signal of input.intelligence.signals) {
    const preferenceId = makeId("pref");
    const preference: Inserts<"guest_preferences"> = {
      id: preferenceId,
      property_id: ROSEPULSE_PROPERTY_ID,
      guest_id: input.guestId,
      category: signal.preferenceCategory,
      label: signal.label,
      detail: signal.detail,
      confidence: signal.confidence,
      status: "candidate",
      source_type: "voice_note"
    };
    const { error: preferenceError } = await supabase.from("guest_preferences").insert(preference);
    if (preferenceError) throw preferenceError;

    const evidence: Inserts<"guest_preference_evidence"> = {
      id: makeId("pe"),
      property_id: ROSEPULSE_PROPERTY_ID,
      preference_id: preferenceId,
      ticket_id: input.ticketId,
      ticket_event_id: input.ticketEventId,
      guest_note_id: null,
      unfiled_voice_note_id: null,
      quote: signal.evidence
    };
    const { error: evidenceError } = await supabase.from("guest_preference_evidence").insert(evidence);
    if (evidenceError) throw evidenceError;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix: "t" | "e" | "u" | "pref" | "pe" | "memo") {
  return makeClientId(prefix);
}
