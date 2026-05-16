import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

interface RecommendNextActionsRequest {
  propertyId: string;
  guestId: string;
  preferences?: Array<{
    category: string;
    label: string;
    detail: string;
    confidence: number;
  }>;
  stayId?: string;
  persist?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, { status: 405 });

  const body = (await req.json()) as RecommendNextActionsRequest;
  if (!body.propertyId || !body.guestId) return jsonResponse({ error: "propertyId and guestId are required" }, { status: 400 });

  const providerMode = Deno.env.get("ROSEPULSE_AI_PROVIDER") ?? "deterministic";
  const preferences = body.preferences ?? [];
  const dominant = preferences.toSorted((a, b) => b.confidence - a.confidence)[0];

  if (!dominant) {
    const recommendation = {
      guestId: body.guestId,
      title: "Confirm arrival ritual",
      rationale: "No dominant preference is confirmed yet. Verify room setup, dining constraints, and communication style at the next staff touchpoint.",
      confidence: 0.56
    };
    const persistedRecommendationId = body.persist === false ? undefined : await persistRecommendation(req, body, recommendation);
    return jsonResponse({
      providerMode,
      persistedRecommendationId,
      recommendations: [recommendation]
    });
  }

  const recommendation = {
    guestId: body.guestId,
    title: recommendationTitle(dominant.category),
    rationale: `Anchor the next service action on "${dominant.label}" because the current evidence is ${Math.round(dominant.confidence * 100)}% confident.`,
    confidence: Math.min(dominant.confidence + 0.08, 0.95)
  };
  const persistedRecommendationId = body.persist === false ? undefined : await persistRecommendation(req, body, recommendation);

  return jsonResponse({
    providerMode,
    persistedRecommendationId,
    recommendations: [recommendation]
  });
});

function recommendationTitle(category: string) {
  if (category === "dining") return "Pre-brief F+B before contact";
  if (category === "room") return "Stage room before arrival";
  if (category === "wellness") return "Offer a precise wellness hold";
  if (category === "security") return "Confirm discreet movement plan";
  if (category === "occasion") return "Personalize the arrival ritual";
  return "Personalize the next touchpoint";
}

async function persistRecommendation(
  req: Request,
  body: RecommendNextActionsRequest,
  recommendation: { title: string; rationale: string; confidence: number }
) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) throw new Error("Supabase Edge Function environment is missing SUPABASE_URL or SUPABASE_ANON_KEY.");

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: req.headers.get("Authorization") ?? ""
      }
    }
  });
  const id = crypto.randomUUID();
  const { error } = await supabase.from("preference_recommendations").insert({
    id,
    property_id: body.propertyId,
    guest_id: body.guestId,
    stay_id: body.stayId ?? null,
    title: recommendation.title,
    rationale: recommendation.rationale,
    confidence: recommendation.confidence,
    status: "pending"
  });
  if (error) throw error;
  return id;
}
