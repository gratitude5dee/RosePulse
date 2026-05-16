import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

type PreferenceCategory = "dining" | "room" | "wellness" | "service" | "accessibility" | "security" | "occasion";

interface ExtractPreferencesRequest {
  propertyId: string;
  guestId: string;
  transcript?: string;
  ticketId?: string;
  ticketEventId?: string;
  noteId?: string;
  unfiledVoiceNoteId?: string;
  persist?: boolean;
}

const CATEGORY_PATTERNS: Array<{ category: PreferenceCategory; pattern: RegExp; label: string }> = [
  { category: "dining", pattern: /allergy|halal|kosher|vegetarian|vegan|breakfast|wine|coffee|tea/i, label: "Dining constraint" },
  { category: "room", pattern: /pillow|mattress|floor|quiet|connecting|espresso|water|temperature/i, label: "Room setup preference" },
  { category: "wellness", pattern: /spa|massage|hammam|yoga|sauna|treatment/i, label: "Wellness preference" },
  { category: "security", pattern: /security|discreet|press|paparazzi|side entrance|privacy/i, label: "Discretion preference" },
  { category: "occasion", pattern: /anniversary|birthday|honeymoon|celebration|cake|flowers/i, label: "Occasion signal" }
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, { status: 405 });

  const body = (await req.json()) as ExtractPreferencesRequest;
  if (!body.propertyId || !body.guestId) return jsonResponse({ error: "propertyId and guestId are required" }, { status: 400 });

  const transcript = body.transcript?.trim() ?? "";
  const match = CATEGORY_PATTERNS.find((item) => item.pattern.test(transcript));
  const providerMode = Deno.env.get("ROSEPULSE_AI_PROVIDER") ?? "deterministic";

  if (!match) {
    return jsonResponse({
      providerMode,
      candidates: [],
      message: "No deterministic preference signal found. Provider-backed extraction can enrich this later."
    });
  }

  const quote = transcript.length > 180 ? `${transcript.slice(0, 177).trim()}...` : transcript;
  const candidate = {
    guestId: body.guestId,
    category: match.category,
    label: match.label,
    detail: quote || "Preference inferred from operational context.",
    confidence: 0.68,
    sourceType: body.ticketEventId ? "voice_note" : body.noteId ? "note" : "ticket",
    evidence: {
      ticketId: body.ticketId,
      ticketEventId: body.ticketEventId,
      guestNoteId: body.noteId,
      unfiledVoiceNoteId: body.unfiledVoiceNoteId,
      quote
    }
  };

  let persistedPreferenceId: string | undefined;
  if (body.persist !== false) {
    const supabase = createUserClient(req);
    persistedPreferenceId = crypto.randomUUID();
    const { error: preferenceError } = await supabase.from("guest_preferences").insert({
      id: persistedPreferenceId,
      property_id: body.propertyId,
      guest_id: body.guestId,
      category: candidate.category,
      label: candidate.label,
      detail: candidate.detail,
      confidence: candidate.confidence,
      status: "candidate",
      source_type: candidate.sourceType
    });

    if (preferenceError) return jsonResponse({ error: preferenceError.message }, { status: 500 });

    const { error: evidenceError } = await supabase.from("guest_preference_evidence").insert({
      property_id: body.propertyId,
      preference_id: persistedPreferenceId,
      ticket_id: body.ticketId ?? null,
      ticket_event_id: body.ticketEventId ?? null,
      guest_note_id: body.noteId ?? null,
      unfiled_voice_note_id: body.unfiledVoiceNoteId ?? null,
      quote: quote || null
    });

    if (evidenceError) return jsonResponse({ error: evidenceError.message }, { status: 500 });
  }

  return jsonResponse({
    providerMode,
    persistedPreferenceId,
    candidates: [candidate]
  });
});

function createUserClient(req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) throw new Error("Supabase Edge Function environment is missing SUPABASE_URL or SUPABASE_ANON_KEY.");

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: req.headers.get("Authorization") ?? ""
      }
    }
  });
}
