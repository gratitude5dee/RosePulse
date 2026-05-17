import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

type TicketCategory = "guest_relations" | "room" | "housekeeping" | "security" | "fnb" | "spa";
type TicketPriority = "low" | "medium" | "high" | "urgent";
type PreferenceCategory = "dining" | "room" | "wellness" | "service" | "accessibility" | "security" | "occasion";
type PrivacySensitivity = "low" | "medium" | "high";

interface ExtractPreferencesRequest {
  transcript: string;
  guestId?: string;
  ticketId?: string;
  memoId?: string;
}

const SCHEMA_VERSION = "guestpulse-v1";

const CATEGORY_PATTERNS: Array<{ category: TicketCategory; pattern: RegExp; confidence: number }> = [
  { category: "housekeeping", pattern: /pillow|blanket|towel|robe|amenity|trash|turndown/i, confidence: 0.82 },
  { category: "room", pattern: /thermostat|ac|tv|remote|safe|lock|key|wifi|mattress|floor/i, confidence: 0.8 },
  { category: "fnb", pattern: /menu|wine|allergy|dietary|breakfast|dinner|chef|restaurant|bar|tea|coffee/i, confidence: 0.84 },
  { category: "spa", pattern: /massage|treatment|sauna|pool|hammam|wellness|yoga/i, confidence: 0.78 },
  { category: "security", pattern: /lost|suspicious|guard|incident|safety|press|paparazzi|private|discreet/i, confidence: 0.86 }
];

const SIGNAL_PATTERNS: Array<{
  category: string;
  preferenceCategory: PreferenceCategory;
  label: string;
  value: string;
  pattern: RegExp;
  confidence: number;
  privacySensitivity: PrivacySensitivity;
}> = [
  {
    category: "allergy_safety",
    preferenceCategory: "dining",
    label: "Allergy & Safety",
    value: "Food allergy or dietary safety constraint noted for F+B service",
    pattern: /allergy|shellfish|nut|walnut|dairy|gluten|kosher|halal|vegan|vegetarian/i,
    confidence: 0.86,
    privacySensitivity: "high"
  },
  {
    category: "sleep_environment",
    preferenceCategory: "room",
    label: "Sleep Environment",
    value: "Room setup or sleep environment preference noted",
    pattern: /pillow|mattress|quiet|elevator|feather|floor|temperature|thermostat/i,
    confidence: 0.78,
    privacySensitivity: "low"
  },
  {
    category: "privacy_preference",
    preferenceCategory: "security",
    label: "Privacy Preference",
    value: "Discreet movement or privacy-sensitive service preference noted",
    pattern: /private|privacy|discreet|do not announce|room number|side entrance|press|paparazzi/i,
    confidence: 0.82,
    privacySensitivity: "high"
  },
  {
    category: "wellness_routine",
    preferenceCategory: "wellness",
    label: "Wellness Routine",
    value: "Wellness, spa, or movement routine preference noted",
    pattern: /spa|massage|hammam|sauna|yoga|wellness|run|walk|meditation|treatment/i,
    confidence: 0.74,
    privacySensitivity: "low"
  },
  {
    category: "communication_style",
    preferenceCategory: "service",
    label: "Communication Style",
    value: "Communication or contact preference noted",
    pattern: /assistant|sms|text|email|no calls|call before|digital/i,
    confidence: 0.76,
    privacySensitivity: "medium"
  }
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, { status: 405 });

  const body = (await req.json().catch(() => null)) as ExtractPreferencesRequest | null;
  const transcript = body?.transcript?.replace(/\s+/g, " ").trim() ?? "";
  if (!transcript) return jsonResponse({ error: "transcript is required" }, { status: 400 });

  const deterministic = analyzeDeterministically(transcript);
  const providerMode = Deno.env.get("ROSEPULSE_AI_PROVIDER") ?? "deterministic";
  const apiKey = Deno.env.get("OPENAI_API_KEY");

  if (providerMode !== "openai" || !apiKey) {
    return jsonResponse(deterministic);
  }

  const ai = await analyzeWithOpenAI(transcript, deterministic, apiKey).catch((error) => ({
    ...deterministic,
    analysisStatus: "failed",
    analysisError: error instanceof Error ? error.message : "OpenAI extraction failed; deterministic routing was used."
  }));

  return jsonResponse(ai);
});

function analyzeDeterministically(transcript: string) {
  const route = CATEGORY_PATTERNS.find((item) => item.pattern.test(transcript));
  const category = route?.category ?? "guest_relations";
  const priority: TicketPriority = /urgent|immediate|right now|incident|unsafe|allergy|medical|locked out|blocked/i.test(transcript)
    ? "urgent"
    : /vip|tonight|delayed|missing|broken|private|discreet|complaint/i.test(transcript)
      ? "high"
      : "medium";
  const signals = SIGNAL_PATTERNS.filter((item) => item.pattern.test(transcript)).map((item, index) => ({
    id: `edge_walkie_${stableHash(`${transcript}-${index}-${item.category}`)}`,
    category: item.category,
    value: item.value,
    evidence: evidenceFor(transcript, item.pattern),
    confidence: item.confidence,
    privacySensitivity: item.privacySensitivity,
    sourceRecordIds: [`walkie_${stableHash(transcript)}`],
    preferenceCategory: item.preferenceCategory,
    label: item.label,
    detail: item.value
  }));

  return {
    schemaVersion: SCHEMA_VERSION,
    provider: "deterministic",
    analysisStatus: "analyzed",
    category,
    priority,
    title: transcriptTitle(transcript),
    routeConfidence: route?.confidence ?? 0.54,
    signals
  };
}

async function analyzeWithOpenAI(transcript: string, fallback: ReturnType<typeof analyzeDeterministically>, apiKey: string) {
  const model = Deno.env.get("OPENAI_EXTRACT_MODEL") ?? "gpt-4o-mini";
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content:
            "Extract luxury hotel operations routing from a walkie transcript. Return JSON with category, priority, title, routeConfidence, and signals. Signals are durable guest preferences, not one-time tasks."
        },
        { role: "user", content: JSON.stringify({ transcript, fallback }) }
      ]
    })
  });

  if (!response.ok) throw new Error(`OpenAI extraction failed with ${response.status}`);
  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("OpenAI extraction returned no content.");
  const parsed = JSON.parse(content);
  return {
    ...fallback,
    ...parsed,
    schemaVersion: SCHEMA_VERSION,
    provider: "openai",
    model,
    analysisStatus: "analyzed",
    signals: Array.isArray(parsed.signals) && parsed.signals.length > 0 ? parsed.signals : fallback.signals
  };
}

function evidenceFor(transcript: string, pattern: RegExp) {
  const match = pattern.exec(transcript);
  if (!match || match.index === undefined) return transcript.slice(0, 180);
  const start = Math.max(0, match.index - 80);
  const end = Math.min(transcript.length, match.index + match[0].length + 120);
  return transcript.slice(start, end).trim();
}

function transcriptTitle(transcript: string) {
  return transcript.length <= 72 ? transcript : `${transcript.slice(0, 69).trim()}...`;
}

function stableHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}
