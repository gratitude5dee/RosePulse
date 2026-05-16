export type StaffRole =
  | "concierge"
  | "front_desk"
  | "housekeeping_lead"
  | "fnb_captain"
  | "spa_supervisor"
  | "security_lead"
  | "manager";

export type GuestStatus =
  | "arriving_today"
  | "checked_in"
  | "in_house"
  | "departing_today"
  | "upcoming"
  | "checked_out";

export type LoyaltyTier = "Standard" | "Silver" | "Gold" | "Platinum" | "Founder";

export interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  preferredName?: string;
  pronouns?: string;
  avatarUrl?: string;
  loyaltyTier: LoyaltyTier;
  vip: boolean;
  arrivalDate: string;
  departureDate: string;
  status: GuestStatus;
  roomNumber?: string;
  roomType: string;
  partySize: number;
  occasion?: "anniversary" | "birthday" | "honeymoon" | "business" | "leisure";
  languages: string[];
  homeCity?: string;
  tags: string[];
  notes?: string;
}

export type TicketCategory = "guest_relations" | "room" | "housekeeping" | "security" | "fnb" | "spa";

export type TicketPriority = "low" | "medium" | "high" | "urgent";

export type TicketStatus = "open" | "in_progress" | "blocked" | "resolved" | "escalated";

export interface TicketEvent {
  id: string;
  ticketId: string;
  type: "created" | "status_changed" | "escalated" | "comment" | "voice_note" | "assigned";
  actorId: string;
  actorName: string;
  at: string;
  body?: string;
  audioUrl?: string;
  fromStatus?: TicketStatus;
  toStatus?: TicketStatus;
  escalatedTo?: StaffRole;
}

export interface Ticket {
  id: string;
  guestId: string;
  category: TicketCategory;
  title: string;
  detail: string;
  priority: TicketPriority;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  assignedTo?: StaffRole;
  dueAt?: string;
  events: TicketEvent[];
}

export interface Staff {
  id: string;
  name: string;
  role: StaffRole;
  avatarUrl?: string;
  onShift: boolean;
}

export interface TranscriptSegment {
  id: string;
  text: string;
  at: string;
  isFinal: boolean;
}

export interface UnfiledVoiceNote {
  id: string;
  transcript: string;
  category: TicketCategory;
  priority: TicketPriority;
  createdAt: string;
  guestId?: string;
  ticketId?: string;
  filedAt?: string;
  filedBy?: string;
}

export interface NewTicketDraft {
  guestId?: string;
  category?: TicketCategory;
}

export type BackendMode = "fixtures" | "supabase";
export type BackendSyncStatus = "idle" | "hydrating" | "syncing" | "synced" | "error";

export interface BackendSyncState {
  mode: BackendMode;
  status: BackendSyncStatus;
  message?: string;
  lastSyncedAt?: string;
  pendingActions: number;
}

export type PreferenceCategory =
  | "dining"
  | "room"
  | "wellness"
  | "service"
  | "accessibility"
  | "security"
  | "occasion";

export type PreferenceStatus = "candidate" | "confirmed" | "dismissed";
export type PreferenceSourceType = "tag" | "note" | "ticket" | "voice_note" | "staff";

export interface GuestPreference {
  id: string;
  guestId: string;
  category: PreferenceCategory;
  label: string;
  detail: string;
  confidence: number;
  status: PreferenceStatus;
  sourceType: PreferenceSourceType;
  evidenceIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PreferenceRecommendation {
  id: string;
  guestId: string;
  title: string;
  rationale: string;
  confidence: number;
  status: "pending" | "accepted" | "dismissed";
  createdAt: string;
}

export interface GuestCrmState {
  guests: Guest[];
  tickets: Ticket[];
  staff: Staff[];
  preferences: GuestPreference[];
  recommendations: PreferenceRecommendation[];
  focusedGuestId?: string;
  detailGuestId?: string;
  focusedTicketId?: string;
  newTicketOpen: boolean;
  newTicketDraft?: NewTicketDraft;
  unfiledNotes: UnfiledVoiceNote[];
  backend: BackendSyncState;
}

/** Raw intake channel for GuestPulse extraction (text only in MVP). */
export type IntakeSourceType =
  | "reservation"
  | "pre_arrival"
  | "vip_call"
  | "staff_note"
  | "past_stay"
  | "feedback_survey";

/** Staff-facing department label for routing and demo filters. */
export type IntakeDepartment =
  | "front_desk"
  | "concierge"
  | "housekeeping"
  | "fnb"
  | "spa"
  | "guest_relations"
  | "reservations"
  | "security";

/** Single pasted or synced intake note before extraction. */
export interface IntakeRecord {
  id: string;
  guestId: string;
  sourceType: IntakeSourceType;
  sourceDepartment: IntakeDepartment | string;
  rawText: string;
  capturedAt: string;
}

/** How sensitive this signal is if surfaced outside the core guest team. */
export type GuestSignalPrivacySensitivity = "low" | "medium" | "high";

/** Structured preference or fact inferred from intake (no department actions). */
export interface GuestSignal {
  id: string;
  category: string;
  value: string;
  evidence: string;
  /** 0–1; extractor sets based on text clarity. */
  confidence: number;
  privacySensitivity: GuestSignalPrivacySensitivity;
  sourceRecordIds: string[];
}

/** Profile handed to downstream action pipelines after merge. */
export interface EnrichedGuestProfile {
  guestId: string;
  identity: {
    firstName: string;
    lastName: string;
    preferredName?: string;
  };
  status: GuestStatus;
  /** Marketing or service segment, e.g. wellness-focused Founder. */
  segment: string;
  currentStay: {
    arrivalDate: string;
    departureDate: string;
    roomNumber?: string;
    roomType: string;
    partySize: number;
  };
  signals: GuestSignal[];
  summary: string;
  lastUpdatedAt?: string;
}

/** One demo guest with CRM row, optional prior signals, and historical intake rows. */
export interface GuestPulseGuestFixture {
  guest: Guest;
  segment: string;
  existingSignals: GuestSignal[];
  intakeRecords: IntakeRecord[];
}
