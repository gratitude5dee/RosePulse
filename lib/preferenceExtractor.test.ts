import { describe, expect, it } from "vitest";
import { guestPulseMockGuests } from "@/lib/mockGuests";
import type { IntakeRecord } from "@/lib/types";
import { preferenceExtractor } from "@/lib/preferenceExtractor";

const eleanorFixture = guestPulseMockGuests[0];
const eleanorStaffNote = eleanorFixture.intakeRecords.find((r) => r.id === "ir_el_staff_01");

if (!eleanorStaffNote) {
  throw new Error("GuestPulse test fixture: Eleanor staff note ir_el_staff_01 missing");
}

describe("PreferenceExtractor", () => {
  it("extracts food, wellness, emotional, and privacy signals from Eleanor terrace breakfast staff note", () => {
    const signals = preferenceExtractor.extract(eleanorStaffNote);
    const categories = new Set(signals.map((s) => s.category));

    expect(categories.has("food_beverage")).toBe(true);
    expect(categories.has("wellness_routine")).toBe(true);
    expect(categories.has("emotional_context")).toBe(true);
    expect(categories.has("privacy_preference")).toBe(true);

    expect(signals.every((s) => s.sourceRecordIds.includes(eleanorStaffNote.id))).toBe(true);
    expect(signals.every((s) => s.evidence.trim().length > 0)).toBe(true);
    expect(signals.every((s) => s.confidence >= 0 && s.confidence <= 1)).toBe(true);
    expect(signals.every((s) => !/please\s+arrange/i.test(s.value))).toBe(true);
  });

  it("returns no signals when raw text is empty or whitespace", () => {
    const blank: IntakeRecord = { ...eleanorStaffNote, rawText: "   \n\t  " };
    expect(preferenceExtractor.extract(blank)).toEqual([]);
  });

  it("returns no signals for vague text with no supported anchors", () => {
    const vague: IntakeRecord = { ...eleanorStaffNote, rawText: "nice hotel" };
    expect(preferenceExtractor.extract(vague)).toEqual([]);
  });

  it("does not emit department action items as signals", () => {
    const routed: IntakeRecord = {
      ...eleanorStaffNote,
      rawText:
        "Please arrange airport transport and escalate to engineering for Wi-Fi. " +
        "Guest mentioned oatmeal with oat milk."
    };
    const signals = preferenceExtractor.extract(routed);
    expect(signals.some((s) => /\bescalate\s+to\b/i.test(s.evidence) || /\bplease\s+arrange\b/i.test(s.evidence))).toBe(
      false
    );
    expect(signals.some((s) => s.category === "food_beverage")).toBe(true);
  });
});
