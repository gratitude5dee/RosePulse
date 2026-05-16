"use client";

import { getBrowserSupabase } from "@/lib/supabase/client";
import { ROSEPULSE_PROPERTY_ID, isSupabaseConfigured } from "@/lib/supabase/config";

const REALTIME_TABLES = ["tickets", "ticket_events", "unfiled_voice_notes", "guest_preferences", "guest_preference_evidence"] as const;

export function subscribeToGuestCrmChanges(onChange: () => void) {
  if (!isSupabaseConfigured()) return () => undefined;

  const supabase = getBrowserSupabase();
  const channel = supabase.channel(`rosepulse-property-${ROSEPULSE_PROPERTY_ID}`);

  for (const table of REALTIME_TABLES) {
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table,
        filter: `property_id=eq.${ROSEPULSE_PROPERTY_ID}`
      },
      () => onChange()
    );
  }

  void channel.subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
