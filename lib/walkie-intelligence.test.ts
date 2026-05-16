import { describe, expect, it } from "vitest";
import { analyzeWalkieTranscript } from "@/lib/walkie-intelligence";

describe("analyzeWalkieTranscript", () => {
  it("routes dining allergy and dinner requests to F+B with urgent priority and signals", () => {
    const result = analyzeWalkieTranscript({
      guestId: "g_0421",
      transcript: "Guest has a nut allergy for dinner tonight. Please alert the chef and restaurant captain."
    });

    expect(result.category).toBe("fnb");
    expect(result.priority).toBe("urgent");
    expect(result.signals.some((signal) => signal.preferenceCategory === "dining")).toBe(true);
  });

  it("routes towel and turndown requests to housekeeping", () => {
    const result = analyzeWalkieTranscript({
      transcript: "Suite needs extra towels and turndown amenity before the guest returns."
    });

    expect(result.category).toBe("housekeeping");
    expect(result.routeConfidence).toBeGreaterThanOrEqual(0.6);
  });

  it("routes wifi and lock issues to room", () => {
    const result = analyzeWalkieTranscript({
      transcript: "Guest says the wifi is down and the room lock battery is failing."
    });

    expect(result.category).toBe("room");
  });

  it("routes treatment requests to spa", () => {
    const result = analyzeWalkieTranscript({
      transcript: "Guest asked for a hammam treatment and late massage availability."
    });

    expect(result.category).toBe("spa");
    expect(result.signals.some((signal) => signal.preferenceCategory === "wellness")).toBe(true);
  });

  it("routes safety incidents to security with urgent priority", () => {
    const result = analyzeWalkieTranscript({
      transcript: "Suspicious incident near the side entrance. Security guard needed now."
    });

    expect(result.category).toBe("security");
    expect(result.priority).toBe("urgent");
  });

  it("falls back to guest relations when confidence is low", () => {
    const result = analyzeWalkieTranscript({
      transcript: "Guest would like a thoughtful follow up sometime today."
    });

    expect(result.category).toBe("guest_relations");
    expect(result.routeConfidence).toBeLessThan(0.6);
  });
});
