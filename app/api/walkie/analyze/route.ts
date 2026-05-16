import { NextResponse } from "next/server";
import { z } from "zod";
import { analyzeWalkieTranscript } from "@/lib/walkie-intelligence";

const analyzeWalkieSchema = z.object({
  transcript: z.string().trim().min(1, "transcript is required"),
  guestId: z.string().trim().min(1).optional(),
  ticketId: z.string().trim().min(1).optional()
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

  return NextResponse.json(analyzeWalkieTranscript(parsed.data));
}
