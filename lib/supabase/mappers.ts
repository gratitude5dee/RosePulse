import type {
  Guest,
  GuestCrmState,
  GuestPreference,
  PreferenceRecommendation,
  Staff,
  Ticket,
  TicketEvent,
  UnfiledVoiceNote,
  VoiceNoteMemo,
  WalkieIntelligence
} from "@/lib/types";
import type { Tables } from "@/lib/supabase/database.types";

export interface RemoteCrmRows {
  guests: Tables<"guests">[];
  stays: Tables<"guest_stays">[];
  tags: Tables<"guest_tags">[];
  notes: Tables<"guest_notes">[];
  staff: Tables<"staff_profiles">[];
  tickets: Tables<"tickets">[];
  events: Tables<"ticket_events">[];
  unfiledNotes: Tables<"unfiled_voice_notes">[];
  voiceMemos: Tables<"voice_note_memos">[];
  preferences: Tables<"guest_preferences">[];
  preferenceEvidence: Tables<"guest_preference_evidence">[];
  recommendations: Tables<"preference_recommendations">[];
}

export function mapRemoteRowsToState(rows: RemoteCrmRows, fallback: GuestCrmState): GuestCrmState {
  const staysByGuest = groupBy(rows.stays, (stay) => stay.guest_id);
  const tagsByGuest = groupBy(rows.tags, (tag) => tag.guest_id);
  const notesByGuest = groupBy(rows.notes, (note) => note.guest_id);
  const eventsByTicket = groupBy(rows.events, (event) => event.ticket_id);
  const evidenceByPreference = groupBy(rows.preferenceEvidence, (evidence) => evidence.preference_id);

  const guests: Guest[] = rows.guests.map((guest) => {
    const stay = selectCurrentStay(staysByGuest.get(guest.id) ?? []);
    const notes = (notesByGuest.get(guest.id) ?? []).toSorted((a, b) => b.updated_at.localeCompare(a.updated_at));
    return {
      id: guest.id,
      firstName: guest.first_name,
      lastName: guest.last_name,
      preferredName: guest.preferred_name ?? undefined,
      pronouns: guest.pronouns ?? undefined,
      avatarUrl: guest.avatar_url ?? undefined,
      loyaltyTier: guest.loyalty_tier,
      vip: guest.vip,
      arrivalDate: stay?.arrival_date ?? new Date().toISOString().slice(0, 10),
      departureDate: stay?.departure_date ?? new Date().toISOString().slice(0, 10),
      status: stay?.status ?? "upcoming",
      roomNumber: stay?.room_number ?? undefined,
      roomType: stay?.room_type ?? "Room pending",
      partySize: stay?.party_size ?? 1,
      occasion: stay?.occasion ?? undefined,
      languages: guest.languages,
      homeCity: guest.home_city ?? undefined,
      tags: (tagsByGuest.get(guest.id) ?? []).map((tag) => tag.label),
      notes: notes[0]?.body
    };
  });

  const tickets: Ticket[] = rows.tickets.map((ticket) => ({
    id: ticket.id,
    guestId: ticket.guest_id,
    category: ticket.category,
    title: ticket.title,
    detail: ticket.detail,
    priority: ticket.priority,
    status: ticket.status,
    createdAt: ticket.created_at,
    updatedAt: ticket.updated_at,
    createdBy: ticket.created_by ?? "s_001",
    assignedTo: ticket.assigned_to_role ?? undefined,
    dueAt: ticket.due_at ?? undefined,
    events: (eventsByTicket.get(ticket.id) ?? []).map(mapTicketEvent).toSorted((a, b) => a.at.localeCompare(b.at))
  }));

  return {
    ...fallback,
    guests,
    tickets,
    staff: rows.staff.map(mapStaff),
    unfiledNotes: rows.unfiledNotes.map(mapUnfiledNote),
    voiceMemos: rows.voiceMemos.map(mapVoiceMemo),
    preferences: rows.preferences.map((preference) =>
      mapGuestPreference(
        preference,
        (evidenceByPreference.get(preference.id) ?? []).map(
          (evidence) =>
            evidence.voice_note_memo_id ??
            evidence.ticket_event_id ??
            evidence.guest_note_id ??
            evidence.unfiled_voice_note_id ??
            evidence.ticket_id ??
            evidence.id
        )
      )
    ),
    recommendations: rows.recommendations.map(mapPreferenceRecommendation)
  };
}

function mapStaff(staff: Tables<"staff_profiles">): Staff {
  return {
    id: staff.id,
    name: staff.name,
    role: staff.role,
    avatarUrl: staff.avatar_url ?? undefined,
    onShift: staff.on_shift
  };
}

function mapTicketEvent(event: Tables<"ticket_events">): TicketEvent {
  return {
    id: event.id,
    ticketId: event.ticket_id,
    type: event.type,
    actorId: event.actor_id ?? "s_001",
    actorName: event.actor_name,
    at: event.created_at,
    body: event.body ?? undefined,
    audioUrl: event.audio_url ?? undefined,
    fromStatus: event.from_status ?? undefined,
    toStatus: event.to_status ?? undefined,
    escalatedTo: event.escalated_to ?? undefined
  };
}

function mapUnfiledNote(note: Tables<"unfiled_voice_notes">): UnfiledVoiceNote {
  return {
    id: note.id,
    transcript: note.transcript,
    category: note.category,
    priority: note.priority,
    createdAt: note.created_at,
    guestId: note.guest_id ?? undefined,
    ticketId: note.ticket_id ?? undefined,
    filedAt: note.filed_at ?? undefined,
    filedBy: note.filed_by ?? undefined
  };
}

function mapVoiceMemo(memo: Tables<"voice_note_memos">): VoiceNoteMemo {
  return {
    id: memo.id,
    transcript: memo.transcript,
    title: memo.title,
    category: memo.category,
    priority: memo.priority,
    status: memo.status,
    source: memo.source,
    routeConfidence: memo.route_confidence,
    signalCount: memo.signal_count,
    preferenceCategories: memo.preference_categories,
    createdAt: memo.created_at,
    updatedAt: memo.updated_at,
    guestId: memo.guest_id ?? undefined,
    ticketId: memo.ticket_id ?? undefined,
    ticketEventId: memo.ticket_event_id ?? undefined,
    unfiledVoiceNoteId: memo.unfiled_voice_note_id ?? undefined,
    createdBy: memo.created_by ?? undefined,
    filedAt: memo.filed_at ?? undefined,
    archivedAt: memo.archived_at ?? undefined,
    intelligence: isWalkieIntelligence(memo.intelligence) ? memo.intelligence : undefined
  };
}

function mapGuestPreference(preference: Tables<"guest_preferences">, evidenceIds: string[]): GuestPreference {
  return {
    id: preference.id,
    guestId: preference.guest_id,
    category: preference.category,
    label: preference.label,
    detail: preference.detail,
    confidence: preference.confidence,
    status: preference.status,
    sourceType: preference.source_type,
    evidenceIds,
    createdAt: preference.created_at,
    updatedAt: preference.updated_at
  };
}

function mapPreferenceRecommendation(recommendation: Tables<"preference_recommendations">): PreferenceRecommendation {
  return {
    id: recommendation.id,
    guestId: recommendation.guest_id,
    title: recommendation.title,
    rationale: recommendation.rationale,
    confidence: recommendation.confidence,
    status: recommendation.status,
    createdAt: recommendation.created_at
  };
}

function selectCurrentStay(stays: Tables<"guest_stays">[]) {
  return stays
    .filter((stay) => !stay.archived_at)
    .toSorted((a, b) => statusWeight(a.status) - statusWeight(b.status) || b.arrival_date.localeCompare(a.arrival_date))[0];
}

function statusWeight(status: Tables<"guest_stays">["status"]) {
  if (status === "arriving_today") return 0;
  if (status === "in_house" || status === "checked_in") return 1;
  if (status === "departing_today") return 2;
  if (status === "upcoming") return 3;
  return 4;
}

function groupBy<T>(items: T[], keyFn: (item: T) => string) {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    map.set(key, [...(map.get(key) ?? []), item]);
  }
  return map;
}

function isWalkieIntelligence(value: unknown): value is WalkieIntelligence {
  return Boolean(
    value &&
      typeof value === "object" &&
      "category" in value &&
      "priority" in value &&
      "title" in value &&
      "routeConfidence" in value &&
      "signals" in value &&
      Array.isArray((value as { signals?: unknown }).signals)
  );
}
