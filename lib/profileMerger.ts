import type { EnrichedGuestProfile, Guest, GuestSignal, IntakeRecord } from "@/lib/types";

function normalizeSignalKey(category: string, value: string): string {
  return `${category.trim().toLowerCase()}|${value.trim().toLowerCase()}`;
}

function mergeSignalPair(existing: GuestSignal, incoming: GuestSignal): GuestSignal {
  const sourceRecordIds = [...new Set([...existing.sourceRecordIds, ...incoming.sourceRecordIds])];
  return {
    ...existing,
    confidence: Math.max(existing.confidence, incoming.confidence),
    privacySensitivity:
      rankPrivacy(existing.privacySensitivity) >= rankPrivacy(incoming.privacySensitivity)
        ? existing.privacySensitivity
        : incoming.privacySensitivity,
    sourceRecordIds,
    evidence: existing.evidence === incoming.evidence ? existing.evidence : `${existing.evidence} ${incoming.evidence}`.trim()
  };
}

function rankPrivacy(s: GuestSignal["privacySensitivity"]): number {
  switch (s) {
    case "low":
      return 0;
    case "medium":
      return 1;
    case "high":
      return 2;
    default:
      return 0;
  }
}

function ensureUniqueIds(signals: GuestSignal[]): GuestSignal[] {
  const seen = new Set<string>();
  return signals.map((s) => {
    if (!seen.has(s.id)) {
      seen.add(s.id);
      return s;
    }
    let n = 2;
    let id = `${s.id}_${n}`;
    while (seen.has(id)) {
      n += 1;
      id = `${s.id}_${n}`;
    }
    seen.add(id);
    return { ...s, id };
  });
}

/**
 * Merges CRM guest row, segment label, prior signals, and freshly extracted signals
 * into one handoff profile. Does not mutate `guest`.
 */
function mergeSignals(existing: GuestSignal[], incoming: GuestSignal[]): GuestSignal[] {
  const byKey = new Map<string, GuestSignal>();
  for (const s of existing) {
    byKey.set(normalizeSignalKey(s.category, s.value), { ...s });
  }
  for (const s of incoming) {
    const key = normalizeSignalKey(s.category, s.value);
    const prior = byKey.get(key);
    if (prior) {
      byKey.set(key, mergeSignalPair(prior, s));
    } else {
      byKey.set(key, { ...s });
    }
  }
  return ensureUniqueIds([...byKey.values()]);
}

function buildSummary(segment: string, signals: GuestSignal[]): string {
  const values = signals.map((s) => s.value.trim()).filter(Boolean);
  const preview = [...new Set(values)].slice(0, 4).join(" · ");
  const tail = values.length > 4 ? " …" : "";
  return `${segment}. Notable preferences: ${preview}${tail}`;
}

export interface MergeProfileInput {
  guest: Guest;
  segment: string;
  existingSignals: GuestSignal[];
  newSignals: GuestSignal[];
  intakeRecord: IntakeRecord;
  /** Defaults to `intakeRecord.capturedAt` when omitted. */
  lastUpdatedAt?: string;
}

export function mergeEnrichedGuestProfile(input: MergeProfileInput): EnrichedGuestProfile {
  const { guest, segment, existingSignals, newSignals, intakeRecord } = input;
  const mergedSignals = mergeSignals(existingSignals, newSignals);

  return {
    guestId: guest.id,
    identity: {
      firstName: guest.firstName,
      lastName: guest.lastName,
      preferredName: guest.preferredName
    },
    status: guest.status,
    segment,
    currentStay: {
      arrivalDate: guest.arrivalDate,
      departureDate: guest.departureDate,
      roomNumber: guest.roomNumber,
      roomType: guest.roomType,
      partySize: guest.partySize
    },
    signals: mergedSignals,
    summary: buildSummary(segment, mergedSignals),
    lastUpdatedAt: input.lastUpdatedAt ?? intakeRecord.capturedAt
  };
}

export const profileMerger = {
  merge: mergeEnrichedGuestProfile
};
