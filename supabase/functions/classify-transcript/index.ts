import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

type TicketCategory = "guest_relations" | "room" | "housekeeping" | "security" | "fnb" | "spa";
type TicketPriority = "low" | "medium" | "high" | "urgent";

interface ClassifyTranscriptRequest {
  transcript: string;
  guestId?: string;
  ticketId?: string;
}

const CATEGORY_PATTERNS: Array<{ category: TicketCategory; pattern: RegExp; confidence: number }> = [
  { category: "housekeeping", pattern: /pillow|blanket|towel|robe|amenity|trash|turndown/i, confidence: 0.82 },
  { category: "room", pattern: /thermostat|ac|tv|remote|safe|lock|key|wifi/i, confidence: 0.8 },
  { category: "fnb", pattern: /menu|wine|allergy|dietary|breakfast|dinner|chef|restaurant|bar/i, confidence: 0.84 },
  { category: "spa", pattern: /massage|treatment|sauna|pool|hammam/i, confidence: 0.78 },
  { category: "security", pattern: /lost|suspicious|guard|incident|safety|press|paparazzi/i, confidence: 0.86 }
];

const URGENT_PATTERN = /urgent|immediate|now|incident|unsafe|allergy|blocked|locked out|medical/i;
const HIGH_PATTERN = /before arrival|vip|tonight|delayed|missing|broken|private|discreet/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, { status: 405 });

  const body = (await req.json()) as ClassifyTranscriptRequest;
  const transcript = body.transcript?.trim() ?? "";
  if (!transcript) return jsonResponse({ error: "transcript is required" }, { status: 400 });

  const providerMode = Deno.env.get("ROSEPULSE_AI_PROVIDER") ?? "deterministic";
  const match = CATEGORY_PATTERNS.find((item) => item.pattern.test(transcript));
  const category = match?.category ?? "guest_relations";
  const confidence = match?.confidence ?? 0.58;
  const priority: TicketPriority = URGENT_PATTERN.test(transcript) ? "urgent" : HIGH_PATTERN.test(transcript) ? "high" : "medium";

  return jsonResponse({
    providerMode,
    category,
    priority,
    title: transcriptTitle(transcript),
    confidence,
    suggestedGuestIds: body.guestId ? [body.guestId] : [],
    suggestedTicketIds: body.ticketId ? [body.ticketId] : []
  });
});

function transcriptTitle(transcript: string) {
  const clean = transcript.replace(/\s+/g, " ").trim();
  if (clean.length <= 72) return clean;
  return `${clean.slice(0, 69).trim()}...`;
}
