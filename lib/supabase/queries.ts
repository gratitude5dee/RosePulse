"use client";

import { transcriptTitle } from "@/lib/format";
import { makeClientId } from "@/lib/id";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { ROSEPULSE_PROPERTY_ID } from "@/lib/supabase/config";
import type { Json } from "@/lib/supabase/database.types";
import { mapRemoteRowsToState } from "@/lib/supabase/mappers";
import type { RemoteCrmRows } from "@/lib/supabase/mappers";
import type { GuestCrmAction } from "@/lib/store/reducer";
import { analyzeWalkieTranscript } from "@/lib/walkie-intelligence";
import type { GuestCrmState, PreferenceStatus, StaffRole, TicketCategory, TicketPriority, TicketStatus, VoiceMemoMetadata, WalkieIntelligence } from "@/lib/types";

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
        intelligence: action.payload.intelligence,
        memoMetadata: action.payload.memoMetadata
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
        intelligence: action.payload.intelligence,
        memoMetadata: action.payload.memoMetadata
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
        intelligence: action.payload.intelligence,
        memoMetadata: action.payload.memoMetadata
      });
    case "FILE_UNFILED_NOTE":
      return saveWalkieVoiceMemoFromUnfiled(action.payload, state);
    case "RESOLVE_GUEST_PREFERENCE":
      return resolveGuestPreference(action.payload.preferenceId, action.payload.status, action.payload.note);
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
  memoMetadata?: VoiceMemoMetadata;
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
      }),
    memoMetadata: payload.memoMetadata
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
    analysisProvider: input.memoMetadata?.analysisProvider ?? intelligence?.provider ?? "deterministic",
    analysisModel: input.memoMetadata?.analysisModel ?? intelligence?.model,
    analysisVersion: input.memoMetadata?.analysisVersion ?? intelligence?.schemaVersion ?? "guestpulse-v1",
    analysisStatus: input.memoMetadata?.analysisStatus ?? intelligence?.analysisStatus ?? "analyzed",
    analysisError: input.memoMetadata?.analysisError ?? intelligence?.analysisError,
    transcriptionModel: input.memoMetadata?.transcriptionModel,
    durationSeconds: input.memoMetadata?.durationSeconds,
    transcribedAt: input.memoMetadata?.transcribedAt,
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
  const supabase = getBrowserSupabase();
  const { error } = await supabase.rpc("rosepulse_create_ticket", {
    p_payload: {
      propertyId: ROSEPULSE_PROPERTY_ID,
      ticketId: payload.ticketId ?? makeId("t"),
      createdEventId: payload.createdEventId ?? makeId("e"),
      guestId: payload.guestId,
      category: payload.category,
      priority: payload.priority,
      title: payload.title,
      detail: payload.detail,
      assignedTo: payload.assignedTo,
      dueAt: payload.dueAt
    }
  });
  if (error) throw error;
}

async function updateTicketStatus(ticketId: string, status: TicketStatus, state: GuestCrmState) {
  const ticket = state.tickets.find((item) => item.id === ticketId);
  const supabase = getBrowserSupabase();
  const { error } = await supabase.rpc("rosepulse_update_ticket_status", {
    p_ticket_id: ticketId,
    p_status: status,
    p_body: ticket ? `Status changed from ${ticket.status} to ${status}.` : `Status changed to ${status}.`
  });
  if (error) throw error;
}

async function escalateTicket(ticketId: string, note: string | undefined, state: GuestCrmState) {
  const ticket = state.tickets.find((item) => item.id === ticketId);
  if (!ticket) throw new Error("Ticket not found for escalation");

  const supabase = getBrowserSupabase();
  const { error } = await supabase.rpc("rosepulse_escalate_ticket", {
    p_ticket_id: ticketId,
    p_note: note ?? null
  });
  if (error) throw error;
}

async function addTicketComment(ticketId: string, body: string) {
  const supabase = getBrowserSupabase();
  const { error } = await supabase.rpc("rosepulse_add_ticket_comment", {
    p_ticket_id: ticketId,
    p_body: body
  });
  if (error) throw error;
}

async function assignTicket(ticketId: string, assignedTo: StaffRole) {
  const supabase = getBrowserSupabase();
  const { error } = await supabase.rpc("rosepulse_assign_ticket", {
    p_ticket_id: ticketId,
    p_assigned_to: assignedTo
  });
  if (error) throw error;
}

async function setPriority(ticketId: string, priority: TicketPriority) {
  const supabase = getBrowserSupabase();
  const { error } = await supabase.rpc("rosepulse_set_ticket_priority", {
    p_ticket_id: ticketId,
    p_priority: priority
  });
  if (error) throw error;
}

async function resolveGuestPreference(preferenceId: string, status: Exclude<PreferenceStatus, "candidate">, note?: string) {
  const supabase = getBrowserSupabase();
  const { error } = await supabase.rpc("resolve_guest_preference", {
    p_preference_id: preferenceId,
    p_status: status,
    p_note: note ?? null
  });
  if (error) throw error;
}

function makeId(prefix: "t" | "e" | "u" | "pref" | "pe" | "memo") {
  return makeClientId(prefix);
}
