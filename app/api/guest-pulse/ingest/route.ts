import { NextResponse } from "next/server";
import { runGuestPulseIngest } from "@/lib/guestPulseIngest";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON" }, { status: 400 });
  }

  const result = runGuestPulseIngest(body);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    signals: result.signals,
    enrichedProfile: result.enrichedProfile
  });
}
