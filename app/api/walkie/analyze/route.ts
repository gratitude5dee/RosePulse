import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { analyzeWalkieTranscript, WALKIE_INTELLIGENCE_SCHEMA_VERSION, mapSignalToPreferenceCategory } from "@/lib/walkie-intelligence";
import type { WalkieIntelligence, WalkiePreferenceSignal } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const analyzeWalkieSchema = z.object({
  transcript: z.string().trim().min(1, "transcript is required"),
  guestId: z.string().trim().min(1).optional(),
  ticketId: z.string().trim().min(1).optional()
});

const aiSignalSchema = z.object({
  category: z.string().trim().min(1),
  value: z.string().trim().min(1),
  evidence: z.string().trim().min(1),
  confidence: z.number().min(0).max(1).catch(0.66),
  privacySensitivity: z.enum(["low", "medium", "high"]).catch("low"),
  preferenceCategory: z.enum(["dining", "room", "wellness", "service", "accessibility", "security", "occasion"]).optional(),
  label: z.string().trim().min(1).optional(),
  detail: z.string().trim().min(1).optional()
});

const aiAnalysisSchema = z.object({
  category: z.enum(["guest_relations", "room", "housekeeping", "security", "fnb", "spa"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  title: z.string().trim().min(1).max(160).optional(),
  routeConfidence: z.number().min(0).max(1).optional(),
  signals: z.array(aiSignalSchema).max(8).catch([])
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON" }, { status: 400 });
  }

  const parsed = analyzeWalkieSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, { status: 400 });
  }

  const deterministic = analyzeWalkieTranscript(parsed.data);
  const provider = process.env.ROSEPULSE_AI_PROVIDER?.toLowerCase();
  const apiKey = process.env.OPENAI_API_KEY;

  if (provider !== "openai" || !apiKey) {
    return NextResponse.json(deterministic);
  }

  try {
    const ai = await analyzeWithOpenAI(parsed.data.transcript, deterministic, apiKey);
    return NextResponse.json(ai);
  } catch (error) {
    return NextResponse.json({
      ...deterministic,
      analysisStatus: "failed",
      analysisError: error instanceof Error ? error.message : "OpenAI extraction failed; deterministic routing was used."
    } satisfies WalkieIntelligence);
  }
}

async function analyzeWithOpenAI(transcript: string, fallback: WalkieIntelligence, apiKey: string): Promise<WalkieIntelligence> {
  const model = process.env.OPENAI_EXTRACT_MODEL ?? "gpt-4o-mini";
  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Extract luxury hotel operations routing from a walkie transcript. Return strict JSON with category, priority, title, routeConfidence, and signals. Signals are durable guest preferences, not one-time tasks."
      },
      {
        role: "user",
        content: JSON.stringify({
          allowedCategories: ["guest_relations", "room", "housekeeping", "security", "fnb", "spa"],
          allowedPriorities: ["low", "medium", "high", "urgent"],
          allowedPreferenceCategories: ["dining", "room", "wellness", "service", "accessibility", "security", "occasion"],
          transcript,
          deterministicFallback: {
            category: fallback.category,
            priority: fallback.priority,
            title: fallback.title,
            routeConfidence: fallback.routeConfidence
          }
        })
      }
    ],
    temperature: 0.1
  });

  const content = response.choices[0]?.message.content;
  if (!content) throw new Error("OpenAI extraction returned no content.");
  const parsedJson: unknown = JSON.parse(content);
  const parsed = aiAnalysisSchema.parse(parsedJson);
  const signals: WalkiePreferenceSignal[] = parsed.signals.map((signal, index) => {
    const base = {
      id: `ai_walkie_${stableHash(`${transcript}-${index}-${signal.value}`)}`,
      category: signal.category,
      value: signal.value,
      evidence: signal.evidence,
      confidence: signal.confidence,
      privacySensitivity: signal.privacySensitivity,
      sourceRecordIds: [`walkie_${stableHash(transcript)}`]
    };
    const preferenceCategory = signal.preferenceCategory ?? mapSignalToPreferenceCategory(base);
    return {
      ...base,
      preferenceCategory,
      label: signal.label ?? humanize(signal.category),
      detail: signal.detail ?? signal.value
    };
  });

  return {
    ...fallback,
    schemaVersion: WALKIE_INTELLIGENCE_SCHEMA_VERSION,
    provider: "openai",
    model,
    analysisStatus: "analyzed",
    analysisError: undefined,
    category: parsed.category ?? fallback.category,
    priority: parsed.priority ?? fallback.priority,
    title: parsed.title ?? fallback.title,
    routeConfidence: parsed.routeConfidence ?? fallback.routeConfidence,
    signals: signals.length > 0 ? signals : fallback.signals
  };
}

function humanize(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function stableHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}
