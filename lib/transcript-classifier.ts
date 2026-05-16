import type { TicketCategory } from "@/lib/types";

const CATEGORY_PATTERNS: Array<{ category: TicketCategory; pattern: RegExp }> = [
  { category: "housekeeping", pattern: /\b(pillow|blanket|towel|robe|amenity|trash|turndown)\b/i },
  { category: "room", pattern: /\b(thermostat|ac|tv|remote|safe|lock|key|wifi)\b/i },
  { category: "fnb", pattern: /\b(menu|wine|allergy|dietary|breakfast|dinner|chef|restaurant|bar)\b/i },
  { category: "spa", pattern: /\b(massage|treatment|sauna|pool|hammam)\b/i },
  { category: "security", pattern: /\b(lost|suspicious|guard|incident|safety)\b/i }
];

export function classifyTranscript(transcript: string): { category: TicketCategory; confidence: number } {
  const normalized = transcript.trim();
  if (!normalized) {
    return { category: "guest_relations", confidence: 0.2 };
  }

  const match = CATEGORY_PATTERNS.find(({ pattern }) => pattern.test(normalized));
  if (match) {
    return { category: match.category, confidence: 0.82 };
  }

  return { category: "guest_relations", confidence: 0.48 };
}
