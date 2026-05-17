import { guestFixtures } from "@/lib/fixtures/guests";
import { isoDateFromToday, isoDateTimeFromNow } from "@/lib/format";
import type { Guest, GuestPulseGuestFixture, GuestSignal, IntakeRecord } from "@/lib/types";

const RADHA_ID = "guest_radha_arora_demo";
const PRIYA_ID = "g_0503";

function requireRadhaGuest(): Guest {
  const guest = guestFixtures.find((g) => g.id === RADHA_ID);
  if (!guest) {
    throw new Error("GuestPulse mock: Radha Arora fixture missing from lib/fixtures/guests");
  }
  return guest;
}

function requirePriyaGuest(): Guest {
  const guest = guestFixtures.find((g) => g.id === PRIYA_ID);
  if (!guest) {
    throw new Error("GuestPulse mock: Priya Mehta fixture missing from lib/fixtures/guests");
  }
  return guest;
}

const radhaGuest = requireRadhaGuest();

const radhaIntake: IntakeRecord[] = [
  {
    id: "intake_radha_001",
    guestId: RADHA_ID,
    sourceType: "reservation",
    sourceDepartment: "front_office",
    rawText:
      "Executive VIP arrival for Rosewood Sand Hill hospitality innovation review. Guest has limited time on property and values discreet, polished service. Arrival expected late afternoon.",
    capturedAt: "2026-05-16T10:30:00.000Z"
  },
  {
    id: "intake_radha_002",
    guestId: RADHA_ID,
    sourceType: "public_profile",
    sourceDepartment: "guest_relations",
    rawText:
      "Public interviews suggest guest values sense of place, local culture, handcrafted details, and hospitality that creates lasting memories rather than generic luxury.",
    capturedAt: "2026-05-16T11:00:00.000Z"
  },
  {
    id: "intake_radha_003",
    guestId: RADHA_ID,
    sourceType: "public_profile",
    sourceDepartment: "concierge",
    rawText:
      "Public travel profile mentions interest in historic sites, restaurant and mixology scenes, vintage decor and lighting, arts festivals, locally inspired spa treatments, nature walks, and authentic cuisine.",
    capturedAt: "2026-05-16T11:10:00.000Z"
  },
  {
    id: "intake_radha_004",
    guestId: RADHA_ID,
    sourceType: "staff_note",
    sourceDepartment: "guest_relations",
    rawText:
      "During arrival conversation, guest asked whether the team had noticed any details that make Rosewood Sand Hill feel uniquely Silicon Valley rather than just generically luxurious.",
    capturedAt: "2026-05-16T16:45:00.000Z"
  }
];

const radhaExpectedSignals: GuestSignal[] = [
  {
    id: "signal_radha_001",
    category: "brand_philosophy",
    value: "Guest cares deeply about sense of place and local cultural expression",
    evidence: "values sense of place, local culture, handcrafted details",
    confidence: 0.94,
    privacySensitivity: "low",
    sourceRecordIds: ["intake_radha_002"]
  },
  {
    id: "signal_radha_002",
    category: "personal_interest",
    value: "Guest is interested in design details, vintage decor, and lighting",
    evidence: "interest in vintage decor and lighting",
    confidence: 0.92,
    privacySensitivity: "low",
    sourceRecordIds: ["intake_radha_003"]
  },
  {
    id: "signal_radha_003",
    category: "experience_interest",
    value: "Guest may appreciate locally grounded cultural, dining, and nature experiences",
    evidence:
      "historic sites, restaurant and mixology scenes, arts festivals, locally inspired spa treatments, nature walks, and authentic cuisine",
    confidence: 0.76,
    privacySensitivity: "low",
    sourceRecordIds: ["intake_radha_003"]
  },
  {
    id: "signal_radha_004",
    category: "business_context",
    value: "Guest is evaluating whether the property experience reflects Rosewood Sand Hill's Silicon Valley identity",
    evidence: "asked whether the team had noticed any details that make Rosewood Sand Hill feel uniquely Silicon Valley",
    confidence: 0.9,
    privacySensitivity: "medium",
    sourceRecordIds: ["intake_radha_004"]
  },
  {
    id: "signal_radha_005",
    category: "privacy_preference",
    value: "Guest likely expects discreet, polished service due to executive VIP context",
    evidence: "Executive VIP arrival and values discreet, polished service",
    confidence: 0.78,
    privacySensitivity: "medium",
    sourceRecordIds: ["intake_radha_001"]
  }
];

const eleanorGuest: Guest = {
  id: "ing_eleanor",
  firstName: "Eleanor",
  lastName: "Lang",
  preferredName: "Ellie",
  pronouns: "she/her",
  loyaltyTier: "Platinum",
  vip: true,
  arrivalDate: isoDateFromToday(-1),
  departureDate: isoDateFromToday(4),
  status: "in_house",
  roomNumber: "418",
  roomType: "Garden Suite",
  partySize: 2,
  occasion: "leisure",
  languages: ["en"],
  homeCity: "San Francisco",
  tags: ["Wellness-focused", "Quiet floor", "Early riser"],
  notes: "Primary GuestPulse demo guest. Values discretion; partner joining mid-stay."
};

const eleanorIntake: IntakeRecord[] = [
  {
    id: "ir_el_res_01",
    guestId: eleanorGuest.id,
    sourceType: "reservation",
    sourceDepartment: "reservations",
    capturedAt: isoDateTimeFromNow(-120),
    rawText:
      "CRS NOTES — Lang / Eleanor. 2 guests, Garden Suite 418. Rate: BAR wellness. " +
      "Arrival flight UA 182 2:10 PM. Requested feather-free pillows and extra still water in room."
  },
  {
    id: "ir_el_pre_01",
    guestId: eleanorGuest.id,
    sourceType: "pre_arrival",
    sourceDepartment: "concierge",
    capturedAt: isoDateTimeFromNow(-96),
    rawText:
      "Pre-arrival email: Would love a 7 AM stretch session on the lawn if weather permits. " +
      "No dietary restrictions but prefers light, savory breakfast over pastries."
  },
  {
    id: "ir_el_vip_01",
    guestId: eleanorGuest.id,
    sourceType: "vip_call",
    sourceDepartment: "guest_relations",
    capturedAt: isoDateTimeFromNow(-72),
    rawText:
      "VIP line — Ms. Lang asked that we not announce her room number aloud at the desk. " +
      "She is sensitive to strong floral scents in public areas."
  },
  {
    id: "ir_el_staff_01",
    guestId: eleanorGuest.id,
    sourceType: "staff_note",
    sourceDepartment: "fnb",
    capturedAt: isoDateTimeFromNow(-18),
    rawText:
      "Terrace breakfast — Guest runs every morning before breakfast; oatmeal preferred with oat milk only. " +
      "Please avoid dairy. Asked that housekeeping not enter during meditation window 6:30–7:15 AM."
  },
  {
    id: "ir_el_past_01",
    guestId: eleanorGuest.id,
    sourceType: "past_stay",
    sourceDepartment: "guest_relations",
    capturedAt: isoDateTimeFromNow(-2400),
    rawText:
      "Last stay (archived): Appreciated handwritten welcome card. Mentioned sleep is light — " +
      "requested high floor away from elevator and no turn-down music."
  },
  {
    id: "ir_el_fb_01",
    guestId: eleanorGuest.id,
    sourceType: "feedback_survey",
    sourceDepartment: "guest_relations",
    capturedAt: isoDateTimeFromNow(-168),
    rawText:
      "Post-stay survey paste: Spa excellent. Room service timing inconsistent. " +
      "Would like clearer communication on minibar charges. Overall likely to return."
  }
];

const eleanorExistingSignals: GuestSignal[] = [
  {
    id: "sig_el_arch_01",
    category: "sleep_environment",
    value: "Prefers quiet room away from elevator; no turn-down music",
    evidence:
      "Last stay (archived): Mentioned sleep is light — requested high floor away from elevator and no turn-down music.",
    confidence: 0.86,
    privacySensitivity: "low",
    sourceRecordIds: ["ir_el_past_01"]
  },
  {
    id: "sig_el_arch_02",
    category: "service_style",
    value: "Appreciates handwritten welcome touches",
    evidence: "Last stay (archived): Appreciated handwritten welcome card.",
    confidence: 0.78,
    privacySensitivity: "low",
    sourceRecordIds: ["ir_el_past_01"]
  }
];

const adrianGuest: Guest = {
  id: "ing_adrian",
  firstName: "Adrian",
  lastName: "Park",
  pronouns: "he/him",
  loyaltyTier: "Gold",
  vip: false,
  arrivalDate: isoDateFromToday(0),
  departureDate: isoDateFromToday(3),
  status: "arriving_today",
  roomType: "Manor Room",
  partySize: 1,
  occasion: "business",
  languages: ["en", "ko"],
  homeCity: "Seattle",
  tags: ["Late arrival", "Espresso", "Firm pillow"],
  notes: "Conference attendee; prefers digital communication over phone."
};

const adrianIntake: IntakeRecord[] = [
  {
    id: "ir_ad_res_01",
    guestId: adrianGuest.id,
    sourceType: "reservation",
    sourceDepartment: "reservations",
    capturedAt: isoDateTimeFromNow(-60),
    rawText:
      "OTA message: Arriving after 11 PM. Need guaranteed late check-in. Double espresso machine in room if possible."
  },
  {
    id: "ir_ad_staff_01",
    guestId: adrianGuest.id,
    sourceType: "staff_note",
    sourceDepartment: "front_desk",
    capturedAt: isoDateTimeFromNow(-6),
    rawText:
      "Walk-in note: Asked for fastest Wi-Fi tips and a second key for colleague visiting briefly tomorrow morning."
  }
];

const priyaGuest = requirePriyaGuest();

const priyaIntake: IntakeRecord[] = [
  {
    id: "ir_pr_pre_01",
    guestId: priyaGuest.id,
    sourceType: "pre_arrival",
    sourceDepartment: "concierge",
    capturedAt: isoDateTimeFromNow(-36),
    rawText:
      "Concierge thread: Interested in vegetarian tasting menu Thursday. Partner has mild nut allergy — almond ok, walnut not ok."
  },
  {
    id: "ir_pr_staff_01",
    guestId: priyaGuest.id,
    sourceType: "staff_note",
    sourceDepartment: "housekeeping",
    capturedAt: isoDateTimeFromNow(-12),
    rawText:
      "HK: Guest requested jasmine buds refreshed daily but no spray fragrance in bathroom."
  }
];

/** GuestPulse demo profiles aligned with PLAN.md (Radha is the executive VIP public-profile example). */
export const guestPulseMockGuests: GuestPulseGuestFixture[] = [
  {
    guest: radhaGuest,
    segment: "Executive VIP hospitality innovation review",
    existingSignals: radhaExpectedSignals,
    intakeRecords: radhaIntake
  },
  {
    guest: eleanorGuest,
    segment: "Wellness-minded Platinum in-house guest",
    existingSignals: eleanorExistingSignals,
    intakeRecords: eleanorIntake
  },
  {
    guest: adrianGuest,
    segment: "Business Gold arriving today",
    existingSignals: [],
    intakeRecords: adrianIntake
  },
  {
    guest: priyaGuest,
    segment: "Anniversary Founder couple; vegetarian tasting focus",
    existingSignals: [],
    intakeRecords: priyaIntake
  }
];

export function guestPulseMockGuestById(guestId: string): GuestPulseGuestFixture | undefined {
  return guestPulseMockGuests.find((row) => row.guest.id === guestId);
}

export function intakeRecordsForGuest(guestId: string): IntakeRecord[] {
  return guestPulseMockGuestById(guestId)?.intakeRecords ?? [];
}
