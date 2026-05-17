import { z } from "zod";
import { guestPulseMockGuestById } from "@/lib/mockGuests";
import { preferenceExtractor } from "@/lib/preferenceExtractor";
import { mergeEnrichedGuestProfile } from "@/lib/profileMerger";
import type { EnrichedGuestProfile, GuestSignal, IntakeRecord, IntakeSourceType } from "@/lib/types";

const intakeSourceTypeSchema = z.enum([
  "reservation",
  "pre_arrival",
  "vip_call",
  "staff_note",
  "past_stay",
  "public_profile",
  "feedback_survey",
  "voice_note"
]);

export type GuestPulseIngestBody = {
  guestId: string;
  sourceType: IntakeSourceType;
  sourceDepartment: string;
  rawText: string;
};

export type GuestPulseIngestSuccess = {
  signals: GuestSignal[];
  enrichedProfile: EnrichedGuestProfile;
};

export type GuestPulseIngestFailure = {
  status: number;
  error: string;
};

function parseBody(body: unknown): GuestPulseIngestBody | GuestPulseIngestFailure {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { status: 400, error: "Request body must be a JSON object" };
  }

  const o = body as Record<string, unknown>;

  if (typeof o.guestId !== "string" || !o.guestId.trim()) {
    return { status: 400, error: "guestId is required" };
  }

  if (!("rawText" in o)) {
    return { status: 400, error: "rawText is required" };
  }
  if (typeof o.rawText !== "string") {
    return { status: 400, error: "rawText must be a string" };
  }

  if (typeof o.sourceDepartment !== "string" || !o.sourceDepartment.trim()) {
    return { status: 400, error: "sourceDepartment is required" };
  }

  const sourceTypeResult = intakeSourceTypeSchema.safeParse(o.sourceType);
  if (!sourceTypeResult.success) {
    return {
      status: 400,
      error:
        "sourceType must be one of: reservation, pre_arrival, vip_call, staff_note, past_stay, public_profile, feedback_survey, voice_note"
    };
  }

  return {
    guestId: o.guestId.trim(),
    sourceType: sourceTypeResult.data,
    sourceDepartment: o.sourceDepartment.trim(),
    rawText: o.rawText
  };
}

/**
 * Validates input, loads the mock guest fixture, extracts signals, and merges into an enriched profile.
 */
export function runGuestPulseIngest(body: unknown): GuestPulseIngestSuccess | GuestPulseIngestFailure {
  const parsed = parseBody(body);
  if ("error" in parsed) {
    return parsed;
  }

  const fixture = guestPulseMockGuestById(parsed.guestId);
  if (!fixture) {
    return { status: 404, error: `Unknown guestId: ${parsed.guestId}` };
  }

  const intakeRecord: IntakeRecord = {
    id: `ir_ingest_${crypto.randomUUID()}`,
    guestId: parsed.guestId,
    sourceType: parsed.sourceType,
    sourceDepartment: parsed.sourceDepartment,
    rawText: parsed.rawText,
    capturedAt: new Date().toISOString()
  };

  const signals = preferenceExtractor.extract(intakeRecord);
  const enrichedProfile = mergeEnrichedGuestProfile({
    guest: fixture.guest,
    segment: fixture.segment,
    existingSignals: fixture.existingSignals,
    newSignals: signals,
    intakeRecord
  });

  return { signals, enrichedProfile };
}
