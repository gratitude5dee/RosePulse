"use client";

import { bumpPriority, CATEGORY_META, getEscalationTarget } from "@/lib/categories";
import { transcriptTitle } from "@/lib/format";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { ROSEPULSE_PROPERTY_ID } from "@/lib/supabase/config";
import type { Inserts, Updates } from "@/lib/supabase/database.types";
import { mapRemoteRowsToState } from "@/lib/supabase/mappers";
import type { RemoteCrmRows } from "@/lib/supabase/mappers";
import type { GuestCrmAction } from "@/lib/store/reducer";
import type { GuestCrmState, StaffRole, TicketEvent, TicketPriority, TicketStatus } from "@/lib/types";

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
    supabase.from("guest_preferences").select("*").eq("property_id", propertyId),
    supabase.from("guest_preference_evidence").select("*").eq("property_id", propertyId),
    supabase.from("preference_recommendations").select("*").eq("property_id", propertyId)
  ]);

  for (const result of [guests, stays, tags, notes, staff, tickets, events, unfiledNotes, preferences, preferenceEvidence, recommendations]) {
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
    preferences: preferences.data ?? [],
    preferenceEvidence: preferenceEvidence.data ?? [],
    recommendations: recommendations.data ?? []
  };

  return mapRemoteRowsToState(rows, fallback);
}

export function persistGuestCrmAction(action: GuestCrmAction, state: GuestCrmState): Promise<void> | undefined {
  switch (action.type) {
    case "CREATE_TICKET":
      return createTicket(action.payload);
    case "UPDATE_TICKET_STATUS":
      return updateTicketStatus(action.payload.ticketId, action.payload.status, state);
    case "ESCALATE_TICKET":
      return escalateTicket(action.payload.ticketId, action.payload.note, state);
    case "ADD_TICKET_COMMENT":
      return addTicketComment(action.payload.ticketId, action.payload.body);
    case "ADD_VOICE_NOTE":
      return addVoiceNote(action.payload.ticketId, action.payload.transcript, action.payload.audioUrl);
    case "ASSIGN_TICKET":
      return assignTicket(action.payload.ticketId, action.payload.assignedTo);
    case "SET_PRIORITY":
      return setPriority(action.payload.ticketId, action.payload.priority);
    case "ADD_UNFILED_NOTE":
      return addUnfiledNote(action.payload);
    case "FILE_UNFILED_NOTE":
      return fileUnfiledNote(action.payload.noteId, action.payload.guestId, action.payload.priority, state);
    default:
      return undefined;
  }
}

async function createTicket(payload: Extract<GuestCrmAction, { type: "CREATE_TICKET" }>["payload"]) {
  const ticketId = makeId("t");
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
  await insertEvent({
    ticketId,
    type: "created",
    body: payload.detail
  });
  if (payload.voiceNote) {
    await insertEvent({
      ticketId,
      type: "voice_note",
      body: payload.detail
    });
  }
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

async function addVoiceNote(ticketId: string, transcript: string, audioUrl?: string) {
  await updateTicket(ticketId, { updated_at: nowIso() });
  await insertEvent({
    ticketId,
    type: "voice_note",
    body: transcript,
    audioUrl
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

async function addUnfiledNote(payload: Extract<GuestCrmAction, { type: "ADD_UNFILED_NOTE" }>["payload"]) {
  await insertUnfiledNote({
    id: makeId("u"),
    property_id: ROSEPULSE_PROPERTY_ID,
    transcript: payload.transcript,
    category: payload.category,
    priority: payload.priority,
    guest_id: payload.guestId ?? null,
    ticket_id: payload.ticketId ?? null,
    created_by: CURRENT_STAFF.id
  });
}

async function fileUnfiledNote(noteId: string, guestId: string, priority: TicketPriority | undefined, state: GuestCrmState) {
  const note = state.unfiledNotes.find((item) => item.id === noteId);
  if (!note) throw new Error("Unfiled note not found");

  const ticketId = makeId("t");
  await insertTicket({
    id: ticketId,
    property_id: ROSEPULSE_PROPERTY_ID,
    guest_id: guestId,
    category: note.category,
    title: transcriptTitle(note.transcript),
    detail: note.transcript,
    priority: priority ?? note.priority,
    status: "open",
    created_by: CURRENT_STAFF.id,
    assigned_to_role: CATEGORY_META[note.category].leadRole
  });
  await insertEvent({ ticketId, type: "created", body: note.transcript });
  await insertEvent({ ticketId, type: "voice_note", body: note.transcript });

  const supabase = getBrowserSupabase();
  const { error } = await supabase
    .from("unfiled_voice_notes")
    .update({ guest_id: guestId, ticket_id: ticketId, filed_by: CURRENT_STAFF.id, filed_at: nowIso() })
    .eq("id", noteId)
    .eq("property_id", ROSEPULSE_PROPERTY_ID);
  if (error) throw error;
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
  ticketId: string;
  type: TicketEvent["type"];
  body?: string;
  audioUrl?: string;
  fromStatus?: TicketStatus;
  toStatus?: TicketStatus;
  escalatedTo?: StaffRole;
}) {
  await insertTicketEvent({
    id: makeId("e"),
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

async function insertUnfiledNote(row: Inserts<"unfiled_voice_notes">) {
  const supabase = getBrowserSupabase();
  const { error } = await supabase.from("unfiled_voice_notes").insert(row);
  if (error) throw error;
}

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix: "t" | "e" | "u") {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}
