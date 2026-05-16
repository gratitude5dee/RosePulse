"use client";

import { Brain, CheckCircle2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/EmptyState";
import { formatAge } from "@/lib/format";
import { selectPreferencesByGuest, selectRecommendationsByGuest } from "@/lib/store/selectors";
import { useGuestCrm } from "@/lib/store/store-context";
import type { PreferenceCategory } from "@/lib/types";
import { VISUAL_ASSETS } from "@/lib/visual-assets";

const CATEGORY_LABELS: Record<PreferenceCategory, string> = {
  dining: "Dining",
  room: "Room",
  wellness: "Wellness",
  service: "Service",
  accessibility: "Accessibility",
  security: "Security",
  occasion: "Occasion"
};

export function PreferencePanel({ guestId }: { guestId: string }) {
  const { state } = useGuestCrm();
  const preferences = selectPreferencesByGuest(state, guestId);
  const recommendations = selectRecommendationsByGuest(state, guestId);
  const voiceMemoIds = new Set(state.voiceMemos.filter((memo) => memo.guestId === guestId).map((memo) => memo.id));

  if (preferences.length === 0 && recommendations.length === 0) {
    return (
      <EmptyState
        title="Preference intelligence is ready."
        body="Signals from tickets, staff notes, tags, and walkie transcripts will appear here after the Supabase extractor records evidence."
        icon={Sparkles}
        image={VISUAL_ASSETS.asayaSpa}
      />
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="rounded-lg border bg-background/72 p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="display-3">Preference intelligence</h2>
            <p className="text-sm text-muted-foreground">Evidence-backed service signals from the live CRM.</p>
          </div>
          <Badge variant="champagne">{preferences.length} signals</Badge>
        </div>
        <div className="grid gap-3">
          {preferences.map((preference) => (
            <article key={preference.id} className="rounded-md border bg-secondary/25 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">{preference.label}</h3>
                    <Badge variant={preference.status === "confirmed" ? "default" : "secondary"}>
                      {preference.status === "confirmed" ? "Confirmed" : "Candidate"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{preference.detail}</p>
                </div>
                <div className="rounded-full bg-background/80 px-2.5 py-1 font-mono text-xs">
                  {Math.round(preference.confidence * 100)}%
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">{CATEGORY_LABELS[preference.category]}</Badge>
                <span>{preference.sourceType.replace("_", " ")}</span>
                <span>{preference.evidenceIds.length} evidence links</span>
                {preference.evidenceIds.some((id) => voiceMemoIds.has(id)) ? <Badge variant="champagne">Voice memo evidence</Badge> : null}
                <span>{formatAge(preference.updatedAt)}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <aside className="rounded-lg border bg-primary/95 p-5 text-primary-foreground shadow-lg">
        <div className="flex items-center gap-2">
          <Brain className="size-4" />
          <h2 className="text-sm font-semibold">Next best actions</h2>
        </div>
        <div className="mt-4 space-y-3">
          {recommendations.map((recommendation) => (
            <article key={recommendation.id} className="rounded-md border border-primary-foreground/15 bg-primary-foreground/8 p-3">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 size-4 text-accent" />
                <div>
                  <h3 className="text-sm font-semibold">{recommendation.title}</h3>
                  <p className="mt-1 text-xs leading-5 text-primary-foreground/72">{recommendation.rationale}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 text-xs text-primary-foreground/70">
                <span>{Math.round(recommendation.confidence * 100)}% confidence</span>
                <Button variant="secondary" size="sm" className="h-8">
                  Review
                </Button>
              </div>
            </article>
          ))}
          {recommendations.length === 0 ? (
            <p className="text-sm text-primary-foreground/72">No pending recommendations for this stay.</p>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
