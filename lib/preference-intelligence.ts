import type { Guest, GuestPreference, PreferenceCategory, PreferenceRecommendation, Ticket } from "@/lib/types";

const TAG_CATEGORY_PATTERNS: Array<{ category: PreferenceCategory; pattern: RegExp }> = [
  { category: "dining", pattern: /allergy|dining|halal|kosher|vegetarian|breakfast|coffee|tea|champagne|wine|chef/i },
  { category: "room", pattern: /floor|pillow|mattress|room|connecting|quiet|towel|robe|water|espresso/i },
  { category: "wellness", pattern: /spa|massage|hammam|pool|yoga|sauna|treatment/i },
  { category: "service", pattern: /check-in|checkout|invoice|transfer|assistant|protocol|arrival|privacy/i },
  { category: "security", pattern: /security|discreet|press|paparazzi|side entrance|safety/i },
  { category: "occasion", pattern: /anniversary|birthday|honeymoon|cake|flowers|celebration/i }
];

export function inferPreferenceCategory(text: string): PreferenceCategory {
  return TAG_CATEGORY_PATTERNS.find(({ pattern }) => pattern.test(text))?.category ?? "service";
}

export function createFixturePreferences(guests: Guest[], tickets: Ticket[]): GuestPreference[] {
  const ticketEvidenceByGuest = new Map<string, string[]>();
  for (const ticket of tickets) {
    const evidence = ticket.events.map((event) => event.id);
    ticketEvidenceByGuest.set(ticket.guestId, [...(ticketEvidenceByGuest.get(ticket.guestId) ?? []), ...evidence]);
  }

  return guests.flatMap((guest) =>
    guest.tags.slice(0, 3).map((tag, index) => {
      const evidence = ticketEvidenceByGuest.get(guest.id) ?? [];
      const now = new Date(Date.now() - (index + 1) * 36 * 60 * 60 * 1000).toISOString();
      return {
        id: `pref_${guest.id}_${index + 1}`,
        guestId: guest.id,
        category: inferPreferenceCategory(tag),
        label: tag,
        detail: preferenceDetail(tag),
        confidence: 0.72 + index * 0.05,
        status: index === 0 ? "confirmed" : "candidate",
        sourceType: "tag",
        evidenceIds: evidence.slice(0, 2),
        createdAt: now,
        updatedAt: now
      } satisfies GuestPreference;
    })
  );
}

export function createFixtureRecommendations(guests: Guest[], preferences: GuestPreference[]): PreferenceRecommendation[] {
  return guests
    .filter((guest) => guest.vip || guest.status === "arriving_today")
    .slice(0, 10)
    .map((guest, index) => {
      const preference = preferences.find((item) => item.guestId === guest.id);
      return {
        id: `rec_${guest.id}`,
        guestId: guest.id,
        title: preference ? recommendationTitle(preference) : "Confirm arrival ritual",
        rationale: preference
          ? `Use the ${preference.label.toLowerCase()} signal before the next staff touchpoint.`
          : "No confirmed preference is dominant yet; verify the arrival details with the concierge desk.",
        confidence: preference ? Math.min(preference.confidence + 0.08, 0.96) : 0.62,
        status: "pending",
        createdAt: new Date(Date.now() - (index + 1) * 20 * 60 * 1000).toISOString()
      } satisfies PreferenceRecommendation;
    });
}

function preferenceDetail(label: string) {
  if (/allergy/i.test(label)) return "Treat as a high-sensitivity service constraint and surface it during F+B and room touchpoints.";
  if (/quiet|privacy|discreet|paparazzi|security/i.test(label)) return "Coordinate movements and communications with reduced exposure and minimal interruption.";
  if (/spa|massage|hammam|yoga/i.test(label)) return "Offer a timed wellness hold before proposing broader activities.";
  return "Carry this signal into ticket triage, pre-arrival review, and staff handoff notes.";
}

function recommendationTitle(preference: GuestPreference) {
  if (preference.category === "dining") return "Pre-brief F+B on dining constraints";
  if (preference.category === "room") return "Stage the room to known preferences";
  if (preference.category === "wellness") return "Hold a wellness window proactively";
  if (preference.category === "security") return "Confirm discreet movement plan";
  if (preference.category === "occasion") return "Personalize the arrival occasion";
  return "Personalize the next staff touchpoint";
}
