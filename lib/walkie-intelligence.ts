import { transcriptTitle } from "@/lib/format";
import { preferenceExtractor } from "@/lib/preferenceExtractor";
import { classifyTranscript } from "@/lib/transcript-classifier";
import type {
  GuestSignal,
  IntakeDepartment,
  IntakeRecord,
  PreferenceCategory,
  TicketCategory,
  TicketPriority,
  WalkieIntelligence,
  WalkiePreferenceSignal
} from "@/lib/types";

interface AnalyzeWalkieInput {
  transcript: string;
  guestId?: string;
  ticketId?: string;
  intakeId?: string;
}

const URGENT_PATTERN =
  /\b(urgent|immediate|right now|now|incident|unsafe|allergy|medical|locked out|lockout|blocked|fire|fall|bleeding)\b/i;
const HIGH_PATTERN = /\b(before arrival|vip|tonight|delayed|missing|broken|private|discreet|complaint|anniversary|birthday)\b/i;

const ROUTE_DEPARTMENT: Record<TicketCategory, IntakeDepartment> = {
  guest_relations: "guest_relations",
  room: "front_desk",
  housekeeping: "housekeeping",
  security: "security",
  fnb: "fnb",
  spa: "spa"
};

const SIGNAL_CATEGORY_LABELS: Record<string, string> = {
  allergy_safety: "Allergy & Safety",
  arrival_logistics: "Arrival Logistics",
  billing_clarity: "Billing Clarity",
  communication_style: "Communication Style",
  emotional_context: "Emotional Context",
  food_beverage: "Food & Beverage",
  housekeeping_style: "Housekeeping Style",
  housekeeping_timing: "Housekeeping Timing",
  privacy_preference: "Privacy Preference",
  sensory_preference: "Sensory Preference",
  service_feedback: "Service Feedback",
  service_style: "Service Style",
  sleep_environment: "Sleep Environment",
  wellness_routine: "Wellness Routine"
};

export function analyzeWalkieTranscript(input: AnalyzeWalkieInput): WalkieIntelligence {
  const transcript = input.transcript.replace(/\s+/g, " ").trim();
  const route = classifyTranscript(transcript);
  const category = route.confidence >= 0.6 ? route.category : "guest_relations";
  const record = makeWalkieIntakeRecord({
    transcript,
    guestId: input.guestId,
    category,
    intakeId: input.intakeId
  });

  return {
    category,
    priority: inferWalkiePriority(transcript),
    title: transcriptTitle(transcript),
    routeConfidence: route.confidence,
    signals: preferenceExtractor.extract(record).map(mapSignalToWalkiePreference)
  };
}

export function inferWalkiePriority(transcript: string): TicketPriority {
  if (URGENT_PATTERN.test(transcript)) return "urgent";
  if (HIGH_PATTERN.test(transcript)) return "high";
  return "medium";
}

export function mapSignalToPreferenceCategory(signal: Pick<GuestSignal, "category" | "value" | "evidence">): PreferenceCategory {
  const text = `${signal.category} ${signal.value} ${signal.evidence}`;
  if (/\b(food|beverage|allergy|dining|breakfast|coffee|espresso|wine|tea|halal|kosher|vegetarian|vegan)\b/i.test(text)) {
    return "dining";
  }
  if (/\b(room|pillow|mattress|sleep|floor|quiet|housekeeping|turndown|fragrance|towel|robe)\b/i.test(text)) {
    return "room";
  }
  if (/\b(wellness|spa|massage|hammam|yoga|sauna|meditation|run|routine)\b/i.test(text)) {
    return "wellness";
  }
  if (/\b(security|privacy|private|discreet|press|paparazzi|room number|side entrance)\b/i.test(text)) {
    return "security";
  }
  if (/\b(anniversary|birthday|honeymoon|celebration|cake|flowers)\b/i.test(text)) {
    return "occasion";
  }
  return "service";
}

function makeWalkieIntakeRecord(input: {
  transcript: string;
  guestId?: string;
  category: TicketCategory;
  intakeId?: string;
}): IntakeRecord {
  return {
    id: input.intakeId ?? `walkie_${stableHash(input.transcript)}`,
    guestId: input.guestId ?? "unfiled",
    sourceType: "voice_note",
    sourceDepartment: ROUTE_DEPARTMENT[input.category],
    rawText: input.transcript,
    capturedAt: new Date().toISOString()
  };
}

function mapSignalToWalkiePreference(signal: GuestSignal): WalkiePreferenceSignal {
  const labelBase = SIGNAL_CATEGORY_LABELS[signal.category] ?? humanize(signal.category);
  return {
    ...signal,
    preferenceCategory: mapSignalToPreferenceCategory(signal),
    label: labelBase,
    detail: signal.value
  };
}

function humanize(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function stableHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}
