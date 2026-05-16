import type { GuestSignal, IntakeRecord } from "@/lib/types";

type GuestSignalDraft = Omit<GuestSignal, "id">;

/** Action-style language we deliberately do not emit as guest signals. */
const ACTION_LEAD_IN =
  /\b(please\s+arrange|kindly\s+arrange|need\s+to\s+book|escalate\s+to|create\s+a\s+ticket|follow\s+up\s+with|send\s+engineering)\b/i;

export class PreferenceExtractor {
  /**
   * Converts one intake record into structured guest signals.
   * Empty or whitespace-only text yields no signals (no throw).
   */
  extract(record: IntakeRecord): GuestSignal[] {
    const raw = record.rawText?.trim() ?? "";
    if (!raw) {
      return [];
    }

    const combined: GuestSignalDraft[] = [
      ...extractFoodAndBeverage(raw, record),
      ...extractWellnessAndRoutine(raw, record),
      ...extractEmotionalSignals(raw, record),
      ...extractHousekeepingAndPrivacy(raw, record),
      ...extractCommunicationPreferences(raw, record),
      ...extractSleepEnvironment(raw, record),
      ...extractLoyaltyAndServiceStyle(raw, record),
      ...extractAllergiesAndDiet(raw, record),
      ...extractArrivalLogistics(raw, record),
      ...extractFeedbackThemes(raw, record)
    ];

    const filtered = combined.filter((s) => !ACTION_LEAD_IN.test(s.evidence) && !ACTION_LEAD_IN.test(s.value));

    return assignIds(record, dedupeDrafts(filtered));
  }
}

export const preferenceExtractor = new PreferenceExtractor();

function nextSignalId(record: IntakeRecord, index: number): string {
  return `${record.id}_sig_${String(index + 1).padStart(2, "0")}`;
}

function withSource(
  record: IntakeRecord,
  signals: Omit<GuestSignal, "id" | "sourceRecordIds">[]
): GuestSignalDraft[] {
  return signals.map((s) => ({
    ...s,
    sourceRecordIds: [record.id]
  }));
}

function assignIds(record: IntakeRecord, drafts: GuestSignalDraft[]): GuestSignal[] {
  return drafts.map((s, i) => ({
    ...s,
    id: nextSignalId(record, i)
  }));
}

function clipEvidence(span: string, max = 200): string {
  const t = span.replace(/\s+/g, " ").trim();
  if (t.length <= max) {
    return t;
  }
  return `${t.slice(0, max - 1)}…`;
}

function contextAround(text: string, re: RegExp): string | undefined {
  const m = re.exec(text);
  if (!m || m.index === undefined) {
    return undefined;
  }

  const sentence = evidenceSentenceForMatch(text, m.index, m.index + m[0].length);
  if (sentence) {
    return clipEvidence(sentence);
  }

  const start = Math.max(0, m.index - 24);
  const end = Math.min(text.length, m.index + m[0].length + 120);
  return clipEvidence(text.slice(start, end));
}

function evidenceSentenceForMatch(text: string, matchStart: number, matchEnd: number): string | undefined {
  if (!text.trim()) {
    return undefined;
  }

  for (const match of text.matchAll(/[^.!?]+[.!?]?/g)) {
    const start = match.index;
    const segment = match[0];
    const end = start + segment.length;
    if (start <= matchStart && end >= matchEnd) {
      return segment.trim();
    }
  }

  return undefined;
}

function extractFoodAndBeverage(raw: string, record: IntakeRecord): GuestSignalDraft[] {
  const out: Omit<GuestSignal, "id" | "sourceRecordIds">[] = [];

  if (/\boat\s*milk\b/i.test(raw) && /\boatmeal\b/i.test(raw)) {
    out.push({
      category: "food_beverage",
      value: "Prefers oatmeal with oat milk; avoid dairy in breakfast service",
      evidence: contextAround(raw, /\boatmeal[\s\S]{0,80}oat\s*milk/i) ?? clipEvidence(raw),
      confidence: 0.9,
      privacySensitivity: "low"
    });
  } else if (/\bavoid\s+dairy\b/i.test(raw) || /\bno\s+dairy\b/i.test(raw)) {
    out.push({
      category: "food_beverage",
      value: "Dairy-free preference for food service",
      evidence: contextAround(raw, /\b(avoid\s+dairy|no\s+dairy)\b/i) ?? clipEvidence(raw),
      confidence: 0.82,
      privacySensitivity: "medium"
    });
  }

  if (/\bsavory\b/i.test(raw) && /\bbreakfast\b/i.test(raw) && /\b(pastry|pastries)\b/i.test(raw)) {
    out.push({
      category: "food_beverage",
      value: "Prefers light savory breakfast over pastries",
      evidence: contextAround(raw, /(savory|pastries)[^.]{0,120}/i) ?? clipEvidence(raw),
      confidence: 0.78,
      privacySensitivity: "low"
    });
  }

  if (/\bdouble\s+espresso\b/i.test(raw) || /\bespresso\s+machine\b/i.test(raw)) {
    out.push({
      category: "food_beverage",
      value: "Strong espresso preference; in-room espresso appreciated when possible",
      evidence: contextAround(raw, /\b(espresso|espresso\s+machine)\b/i) ?? clipEvidence(raw),
      confidence: 0.74,
      privacySensitivity: "low"
    });
  }

  return withSource(record, out);
}

function extractWellnessAndRoutine(raw: string, record: IntakeRecord): GuestSignalDraft[] {
  const out: Omit<GuestSignal, "id" | "sourceRecordIds">[] = [];

  if (/\bruns?\s+every\s+morning\b/i.test(raw) || /\b7\s*am\b.*\bstretch\b/i.test(raw)) {
    out.push({
      category: "wellness_routine",
      value: "Morning movement-focused routine (run or outdoor stretch)",
      evidence: contextAround(raw, /\b(runs?\s+every\s+morning|stretch\s+session)\b/i) ?? clipEvidence(raw),
      confidence: /\bruns?\s+every\s+morning\b/i.test(raw) ? 0.88 : 0.72,
      privacySensitivity: "low"
    });
  }

  if (/\bmeditation\b/i.test(raw) && /\b6\s*:?\s*30\b/i.test(raw)) {
    out.push({
      category: "wellness_routine",
      value: "Daily meditation window; prefers minimal interruptions during practice",
      evidence: contextAround(raw, /meditation[\s\S]{0,80}6\s*:?\s*30/i) ?? clipEvidence(raw),
      confidence: 0.84,
      privacySensitivity: "medium"
    });
  }

  if (/\bwellness\b/i.test(raw) && /\brate\b/i.test(raw)) {
    out.push({
      category: "wellness_routine",
      value: "Booked on wellness-oriented rate or package",
      evidence: contextAround(raw, /\bwellness\b/i) ?? clipEvidence(raw),
      confidence: 0.62,
      privacySensitivity: "low"
    });
  }

  if (/\b(spa|massage|hammam|treatment|sauna)\b/i.test(raw)) {
    out.push({
      category: "wellness_routine",
      value: "Wellness or spa treatment interest noted for proactive service timing",
      evidence: contextAround(raw, /\b(spa|massage|hammam|treatment|sauna)\b/i) ?? clipEvidence(raw),
      confidence: 0.74,
      privacySensitivity: "low"
    });
  }

  return withSource(record, out);
}

function extractEmotionalSignals(raw: string, record: IntakeRecord): GuestSignalDraft[] {
  const out: Omit<GuestSignal, "id" | "sourceRecordIds">[] = [];

  if (/\basked\s+that\b/i.test(raw) && /\bmeditation\b/i.test(raw)) {
    out.push({
      category: "emotional_context",
      value: "Communicates needs clearly to protect morning wellness rhythm and personal space",
      evidence: contextAround(raw, /\basked\s+that\b[\s\S]{0,120}meditation/i) ?? clipEvidence(raw),
      confidence: 0.74,
      privacySensitivity: "low"
    });
  }

  return withSource(record, out);
}

function extractHousekeepingAndPrivacy(raw: string, record: IntakeRecord): GuestSignalDraft[] {
  const out: Omit<GuestSignal, "id" | "sourceRecordIds">[] = [];

  if (/\bhousekeeping\b/i.test(raw) && /\bnot\s+enter\b/i.test(raw)) {
    out.push({
      category: "housekeeping_timing",
      value: "Requested housekeeping not enter during stated quiet/meditation window",
      evidence: contextAround(raw, /housekeeping[\s\S]{0,120}not\s+enter/i) ?? clipEvidence(raw),
      confidence: 0.9,
      privacySensitivity: "medium"
    });
    if (/\bmeditation\b/i.test(raw)) {
      out.push({
        category: "privacy_preference",
        value: "Prefers room privacy during morning meditation time",
        evidence: contextAround(raw, /\bmeditation\b/i) ?? clipEvidence(raw),
        confidence: 0.78,
        privacySensitivity: "medium"
      });
    }
  }

  if (/\bnot\s+announce\b.*\broom\s+number\b/i.test(raw) || /\broom\s+number\b.*\bnot\s+announce\b/i.test(raw)) {
    out.push({
      category: "privacy_preference",
      value: "Do not announce room number aloud at front desk",
      evidence: contextAround(raw, /\b(not\s+announce|room\s+number)\b/i) ?? clipEvidence(raw),
      confidence: 0.92,
      privacySensitivity: "high"
    });
  }

  if (/\bstrong\s+floral\s+scents?\b/i.test(raw) && /\b(sensitive|avoid)\b/i.test(raw)) {
    out.push({
      category: "sensory_preference",
      value: "Sensitive to strong floral scents in public areas",
      evidence: contextAround(raw, /\bfloral\s+scents?\b/i) ?? clipEvidence(raw),
      confidence: 0.8,
      privacySensitivity: "low"
    });
  }

  if (/\bjasmine\s+buds\b/i.test(raw) && /\bno\s+spray\s+fragrance\b/i.test(raw)) {
    out.push({
      category: "housekeeping_style",
      value: "Prefers natural jasmine buds refreshed daily; no aerosol/spray fragrance in bathroom",
      evidence: contextAround(raw, /\bjasmine\s+buds\b/i) ?? clipEvidence(raw),
      confidence: 0.86,
      privacySensitivity: "low"
    });
  }

  return withSource(record, out);
}

function extractCommunicationPreferences(raw: string, record: IntakeRecord): GuestSignalDraft[] {
  const out: Omit<GuestSignal, "id" | "sourceRecordIds">[] = [];

  if (/\bdigital\b/i.test(raw) && /\bcommunication\b/i.test(raw) && /\bover\s+phone\b/i.test(raw)) {
    out.push({
      category: "communication_style",
      value: "Prefers digital communication over phone calls",
      evidence: contextAround(raw, /\bdigital\b[\s\S]{0,80}phone/i) ?? clipEvidence(raw),
      confidence: 0.78,
      privacySensitivity: "low"
    });
  }

  return withSource(record, out);
}

function extractSleepEnvironment(raw: string, record: IntakeRecord): GuestSignalDraft[] {
  const out: Omit<GuestSignal, "id" | "sourceRecordIds">[] = [];

  if (/\bsleep\b/i.test(raw) && /\blight\b/i.test(raw) && /\b(high\s+floor|elevator)\b/i.test(raw)) {
    out.push({
      category: "sleep_environment",
      value: "Light sleeper; prefers quieter placement away from elevator noise",
      evidence: contextAround(raw, /\bsleep\b[\s\S]{0,120}elevator/i) ?? clipEvidence(raw),
      confidence: 0.8,
      privacySensitivity: "low"
    });
  }

  if (/\bno\s+turn[- ]?down\s+music\b/i.test(raw)) {
    out.push({
      category: "sleep_environment",
      value: "Prefers no turn-down music",
      evidence: contextAround(raw, /\bturn[- ]?down\s+music\b/i) ?? clipEvidence(raw),
      confidence: 0.84,
      privacySensitivity: "low"
    });
  }

  if (/\bfirm\s+mattress\b/i.test(raw) || (/\bquiet\s+room\b/i.test(raw) && /\belevator\b/i.test(raw))) {
    out.push({
      category: "sleep_environment",
      value: "Prefers firm mattress and quiet room placement",
      evidence: contextAround(raw, /\b(firm\s+mattress|quiet\s+room|elevator)\b/i) ?? clipEvidence(raw),
      confidence: 0.78,
      privacySensitivity: "low"
    });
  }

  if (/\bfeather[- ]?free\b/i.test(raw) || /\bfeather\s+free\b/i.test(raw)) {
    out.push({
      category: "sleep_environment",
      value: "Feather-free bedding requested",
      evidence: contextAround(raw, /\bfeather[- ]?free\b/i) ?? clipEvidence(raw),
      confidence: 0.88,
      privacySensitivity: "low"
    });
  }

  return withSource(record, out);
}

function extractLoyaltyAndServiceStyle(raw: string, record: IntakeRecord): GuestSignalDraft[] {
  const out: Omit<GuestSignal, "id" | "sourceRecordIds">[] = [];

  if (/\bhandwritten\b/i.test(raw) && /\bwelcome\b/i.test(raw)) {
    out.push({
      category: "service_style",
      value: "Responds well to thoughtful handwritten welcome touches",
      evidence: contextAround(raw, /\bhandwritten\b[\s\S]{0,80}welcome/i) ?? clipEvidence(raw),
      confidence: 0.76,
      privacySensitivity: "low"
    });
  }

  if (/\blikely\s+to\s+return\b/i.test(raw) && /\boverall\b/i.test(raw)) {
    out.push({
      category: "emotional_context",
      value: "Overall positive sentiment; likely to return",
      evidence: contextAround(raw, /\blikely\s+to\s+return\b/i) ?? clipEvidence(raw),
      confidence: 0.7,
      privacySensitivity: "low"
    });
  }

  return withSource(record, out);
}

function extractAllergiesAndDiet(raw: string, record: IntakeRecord): GuestSignalDraft[] {
  const out: Omit<GuestSignal, "id" | "sourceRecordIds">[] = [];

  if (/\bvegetarian\b/i.test(raw) && /\btasting\s+menu\b/i.test(raw)) {
    out.push({
      category: "food_beverage",
      value: "Interested in vegetarian tasting menu options",
      evidence: contextAround(raw, /\bvegetarian\b[\s\S]{0,80}tasting/i) ?? clipEvidence(raw),
      confidence: 0.8,
      privacySensitivity: "low"
    });
  }

  if (/\bnut\s+allergy\b/i.test(raw) || /\bwalnut\b/i.test(raw)) {
    const high = /\bwalnut\s+not\s+ok\b/i.test(raw);
    out.push({
      category: "allergy_safety",
      value: "Nut sensitivity called out; walnut specifically not acceptable",
      evidence: contextAround(raw, /\b(nut\s+allergy|walnut)\b/i) ?? clipEvidence(raw),
      confidence: high ? 0.9 : 0.72,
      privacySensitivity: "high"
    });
  }

  return withSource(record, out);
}

function extractArrivalLogistics(raw: string, record: IntakeRecord): GuestSignalDraft[] {
  const out: Omit<GuestSignal, "id" | "sourceRecordIds">[] = [];

  if (/\blate\s+check[- ]?in\b/i.test(raw) && /\b11\s*pm\b/i.test(raw)) {
    out.push({
      category: "arrival_logistics",
      value: "Very late arrival; needs reliable late check-in",
      evidence: contextAround(raw, /\b11\s*pm\b/i) ?? clipEvidence(raw),
      confidence: 0.82,
      privacySensitivity: "low"
    });
  }

  if (/\bUA\s*\d+\b/i.test(raw) && /\bflight\b/i.test(raw)) {
    out.push({
      category: "arrival_logistics",
      value: "Flight detail noted in CRS for meet timing and airport coordination",
      evidence: contextAround(raw, /\bUA\s*\d+\b/i) ?? clipEvidence(raw),
      confidence: 0.68,
      privacySensitivity: "medium"
    });
  }

  return withSource(record, out);
}

function extractFeedbackThemes(raw: string, record: IntakeRecord): GuestSignalDraft[] {
  const out: Omit<GuestSignal, "id" | "sourceRecordIds">[] = [];

  if (/\broom\s+service\b/i.test(raw) && /\binconsistent\b/i.test(raw)) {
    out.push({
      category: "service_feedback",
      value: "Past friction: room service timing felt inconsistent",
      evidence: contextAround(raw, /\broom\s+service\b[\s\S]{0,80}inconsistent/i) ?? clipEvidence(raw),
      confidence: 0.74,
      privacySensitivity: "low"
    });
  }

  if (/\bminibar\b/i.test(raw) && /\bcharg(es|ing)\b/i.test(raw)) {
    out.push({
      category: "billing_clarity",
      value: "Wants clearer communication on minibar charges",
      evidence: contextAround(raw, /\bminibar\b/i) ?? clipEvidence(raw),
      confidence: 0.72,
      privacySensitivity: "medium"
    });
  }

  if (/\bspa\b/i.test(raw) && /\bexcellent\b/i.test(raw)) {
    out.push({
      category: "emotional_context",
      value: "Strong positive sentiment toward spa experience",
      evidence: contextAround(raw, /\bspa\b[\s\S]{0,40}excellent/i) ?? clipEvidence(raw),
      confidence: 0.7,
      privacySensitivity: "low"
    });
  }

  return withSource(record, out);
}

function normalizeKey(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function dedupeDrafts(signals: GuestSignalDraft[]): GuestSignalDraft[] {
  const seen = new Set<string>();
  const out: GuestSignalDraft[] = [];
  for (const s of signals) {
    const key = `${s.category}|${normalizeKey(s.value)}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(s);
  }
  return out;
}
