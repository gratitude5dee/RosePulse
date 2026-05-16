import OpenAI from "openai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const DEFAULT_TRANSCRIBE_MODEL = "gpt-4o-mini-transcribe";

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function normalizeLanguage(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return undefined;
  const language = value.trim().split("-")[0]?.toLowerCase();
  return language && /^[a-z]{2}$/.test(language) ? language : undefined;
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return jsonError("Server transcription is not configured. Add OPENAI_API_KEY in Vercel environment variables.", 503);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("Request body must be multipart form data.", 400);
  }

  const audio = formData.get("audio");
  if (!(audio instanceof File)) {
    return jsonError("Upload an audio file using the 'audio' form field.", 400);
  }

  if (audio.size === 0) {
    return jsonError("Audio file is empty.", 400);
  }

  if (audio.size > MAX_AUDIO_BYTES) {
    return jsonError("Audio file is too large. Keep walkie captures under 60 seconds.", 413);
  }

  if (audio.type && !audio.type.startsWith("audio/")) {
    return jsonError("Uploaded file must be an audio recording.", 415);
  }

  const model = process.env.OPENAI_TRANSCRIBE_MODEL ?? DEFAULT_TRANSCRIBE_MODEL;
  const language = normalizeLanguage(formData.get("lang"));
  const client = new OpenAI({ apiKey });

  try {
    const transcription = await client.audio.transcriptions.create({
      file: audio,
      model,
      ...(language ? { language } : {})
    });

    return NextResponse.json({
      text: transcription.text.trim(),
      model
    });
  } catch (error) {
    console.error("Walkie transcription failed", error);
    return jsonError("Transcription failed. Try again or type the note before saving.", 502);
  }
}
