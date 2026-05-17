import { describe, expect, it } from "vitest";
import { guestPulseMockGuests } from "@/lib/mockGuests";
import { runGuestPulseIngest } from "@/lib/guestPulseIngest";

const radha = guestPulseMockGuests.find((row) => row.guest.id === "guest_radha_arora_demo");
const eleanor = guestPulseMockGuests.find((row) => row.guest.id === "ing_eleanor");
const adrian = guestPulseMockGuests.find((row) => row.guest.id === "ing_adrian");
const eleanorStaffRaw =
  eleanor?.intakeRecords.find((r) => r.id === "ir_el_staff_01")?.rawText ?? "";
const adrianReservationRaw =
  adrian?.intakeRecords.find((r) => r.id === "ir_ad_res_01")?.rawText ?? "";
const radhaPublicProfileRaw =
  radha?.intakeRecords.find((r) => r.id === "intake_radha_003")?.rawText ?? "";

describe("runGuestPulseIngest", () => {
  it("returns Radha public-profile signals without displacing the existing demo guests", () => {
    expect(radha).toBeDefined();
    expect(eleanor).toBeDefined();
    expect(adrian).toBeDefined();
    if (!radha) return;

    const result = runGuestPulseIngest({
      guestId: radha.guest.id,
      sourceType: "public_profile",
      sourceDepartment: "guest_relations",
      rawText: radhaPublicProfileRaw
    });

    expect("error" in result).toBe(false);
    if ("error" in result) {
      return;
    }

    const signalIds = result.enrichedProfile.signals.map((signal) => signal.id);
    expect(result.enrichedProfile.identity.firstName).toBe("Radha");
    expect(signalIds).toContain("signal_radha_001");
    expect(signalIds).toContain("signal_radha_005");
    expect(result.signals.length).toBeGreaterThan(0);
  });

  it("returns signals and enriched profile for a valid Eleanor staff-note style request", () => {
    expect(eleanor).toBeDefined();
    if (!eleanor) return;

    const result = runGuestPulseIngest({
      guestId: eleanor.guest.id,
      sourceType: "staff_note",
      sourceDepartment: "fnb",
      rawText: eleanorStaffRaw
    });

    expect("error" in result).toBe(false);
    if ("error" in result) {
      return;
    }

    expect(result.signals.length).toBeGreaterThan(0);
    expect(result.enrichedProfile.guestId).toBe(eleanor.guest.id);
    expect(result.enrichedProfile.identity.firstName).toBe("Eleanor");
    expect(result.enrichedProfile.signals.length).toBeGreaterThanOrEqual(eleanor.existingSignals.length);
    expect(result.signals.every((s) => s.evidence.length > 0)).toBe(true);
    expect(result.signals.every((s) => ["low", "medium", "high"].includes(s.privacySensitivity))).toBe(true);
  });

  it("returns signals and enriched profile for Adrian reservation intake", () => {
    expect(adrian).toBeDefined();
    if (!adrian) return;

    const result = runGuestPulseIngest({
      guestId: adrian.guest.id,
      sourceType: "reservation",
      sourceDepartment: "reservations",
      rawText: adrianReservationRaw
    });

    expect("error" in result).toBe(false);
    if ("error" in result) {
      return;
    }

    expect(result.signals.length).toBeGreaterThan(0);
    expect(result.enrichedProfile.guestId).toBe(adrian.guest.id);
    expect(result.enrichedProfile.identity.firstName).toBe("Adrian");
    expect(result.enrichedProfile.summary.length).toBeGreaterThan(0);
  });

  it("returns 400 when guestId is missing", () => {
    const result = runGuestPulseIngest({
      sourceType: "staff_note",
      sourceDepartment: "fnb",
      rawText: "hello"
    });

    expect("error" in result).toBe(true);
    if (!("error" in result)) {
      return;
    }
    expect(result.status).toBe(400);
    expect(result.error).toBe("guestId is required");
  });

  it("returns 400 when rawText is missing", () => {
    expect(eleanor).toBeDefined();
    if (!eleanor) return;

    const result = runGuestPulseIngest({
      guestId: eleanor.guest.id,
      sourceType: "staff_note",
      sourceDepartment: "fnb"
    });

    expect("error" in result).toBe(true);
    if (!("error" in result)) {
      return;
    }
    expect(result.status).toBe(400);
    expect(result.error).toBe("rawText is required");
  });

  it("returns 400 when sourceType is invalid", () => {
    expect(eleanor).toBeDefined();
    if (!eleanor) return;

    const result = runGuestPulseIngest({
      guestId: eleanor.guest.id,
      sourceType: "not_a_source",
      sourceDepartment: "fnb",
      rawText: "hello"
    });

    expect("error" in result).toBe(true);
    if (!("error" in result)) {
      return;
    }
    expect(result.status).toBe(400);
    expect(result.error).toContain("sourceType");
  });

  it("returns 404 for an unknown guest id", () => {
    const result = runGuestPulseIngest({
      guestId: "no_such_guest",
      sourceType: "staff_note",
      sourceDepartment: "fnb",
      rawText: "note"
    });

    expect("error" in result).toBe(true);
    if (!("error" in result)) {
      return;
    }
    expect(result.status).toBe(404);
  });
});
