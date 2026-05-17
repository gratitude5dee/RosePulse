import { describe, expect, it } from "vitest";
import { guestPulseMockGuests } from "@/lib/mockGuests";
import { preferenceExtractor } from "@/lib/preferenceExtractor";
import { mergeEnrichedGuestProfile } from "@/lib/profileMerger";
import type { GuestSignal } from "@/lib/types";

const eleanorFixture = guestPulseMockGuests.find((row) => row.guest.id === "ing_eleanor");

if (!eleanorFixture) {
  throw new Error("GuestPulse test fixture: Eleanor fixture missing");
}

const eleanorStaffNote = eleanorFixture.intakeRecords.find((r) => r.id === "ir_el_staff_01");

if (!eleanorStaffNote) {
  throw new Error("GuestPulse test fixture: Eleanor staff note ir_el_staff_01 missing");
}

describe("mergeEnrichedGuestProfile", () => {
  it("merges new Eleanor terrace breakfast signals into her existing profile", () => {
    const newSignals = preferenceExtractor.extract(eleanorStaffNote);
    const enriched = mergeEnrichedGuestProfile({
      guest: eleanorFixture.guest,
      segment: eleanorFixture.segment,
      existingSignals: eleanorFixture.existingSignals,
      newSignals,
      intakeRecord: eleanorStaffNote
    });

    expect(enriched.guestId).toBe(eleanorFixture.guest.id);
    expect(enriched.identity.firstName).toBe("Eleanor");
    expect(enriched.identity.preferredName).toBe("Ellie");
    expect(enriched.status).toBe(eleanorFixture.guest.status);
    expect(enriched.segment).toBe(eleanorFixture.segment);
    expect(enriched.currentStay.roomNumber).toBe("418");
    expect(enriched.lastUpdatedAt).toBe(eleanorStaffNote.capturedAt);

    const categories = new Set(enriched.signals.map((s) => s.category));
    for (const prior of eleanorFixture.existingSignals) {
      expect(categories.has(prior.category)).toBe(true);
    }
    for (const s of newSignals) {
      expect(categories.has(s.category)).toBe(true);
    }
    expect(enriched.summary.length).toBeGreaterThan(20);
    expect(enriched.signals.length).toBeGreaterThanOrEqual(eleanorFixture.existingSignals.length);
  });

  it("merges duplicate category+value signals without duplicating rows", () => {
    const duplicate: GuestSignal = {
      ...eleanorFixture.existingSignals[0],
      id: "sig_dup_01",
      confidence: 0.95,
      evidence: "Repeated confirmation from intake.",
      sourceRecordIds: ["ir_dup_01"]
    };

    const enriched = mergeEnrichedGuestProfile({
      guest: eleanorFixture.guest,
      segment: eleanorFixture.segment,
      existingSignals: eleanorFixture.existingSignals,
      newSignals: [duplicate],
      intakeRecord: eleanorStaffNote
    });

    const sleepSignals = enriched.signals.filter(
      (s) => s.category === eleanorFixture.existingSignals[0].category && s.value === eleanorFixture.existingSignals[0].value
    );
    expect(sleepSignals).toHaveLength(1);
    expect(sleepSignals[0].confidence).toBe(0.95);
    expect(new Set(sleepSignals[0].sourceRecordIds).has("ir_dup_01")).toBe(true);
  });

  it("does not mutate the source Guest object", () => {
    const guestSnapshot = JSON.stringify(eleanorFixture.guest);
    const newSignals = preferenceExtractor.extract(eleanorStaffNote);

    mergeEnrichedGuestProfile({
      guest: eleanorFixture.guest,
      segment: eleanorFixture.segment,
      existingSignals: eleanorFixture.existingSignals,
      newSignals,
      intakeRecord: eleanorStaffNote
    });

    expect(JSON.stringify(eleanorFixture.guest)).toBe(guestSnapshot);
  });
});
