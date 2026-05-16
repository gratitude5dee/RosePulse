"use client";

import { useMemo, useState } from "react";
import { ClipboardCopy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { guestDisplayName } from "@/lib/format";
import { guestPulseMockGuests } from "@/lib/mockGuests";
import type { EnrichedGuestProfile, GuestSignal, IntakeDepartment, IntakeSourceType } from "@/lib/types";

const ELEANOR_ID = "ing_eleanor";
const ADRIAN_ID = "ing_adrian";

/** Seeded staff note from Eleanor fixture — demo without pasting. */
const ELEANOR_BREAKFAST_NOTE =
  "Terrace breakfast — Guest runs every morning before breakfast; oatmeal preferred with oat milk only. " +
  "Please avoid dairy. Asked that housekeeping not enter during meditation window 6:30–7:15 AM.";

/** Seeded OTA reservation from Adrian fixture — second demo guest path. */
const ADRIAN_LATE_ARRIVAL_NOTE =
  "OTA message: Arriving after 11 PM. Need guaranteed late check-in. Double espresso machine in room if possible.";

const SOURCE_OPTIONS: { value: IntakeSourceType; label: string }[] = [
  { value: "reservation", label: "Reservation" },
  { value: "pre_arrival", label: "Pre-arrival" },
  { value: "vip_call", label: "VIP call" },
  { value: "staff_note", label: "Staff note" },
  { value: "past_stay", label: "Past stay" },
  { value: "feedback_survey", label: "Feedback survey" }
];

const DEPARTMENT_OPTIONS: { value: IntakeDepartment; label: string }[] = [
  { value: "front_desk", label: "Front desk" },
  { value: "concierge", label: "Concierge" },
  { value: "housekeeping", label: "Housekeeping" },
  { value: "fnb", label: "F+B" },
  { value: "spa", label: "Spa" },
  { value: "guest_relations", label: "Guest relations" },
  { value: "reservations", label: "Reservations" },
  { value: "security", label: "Security" }
];

const SIGNAL_CATEGORY_LABELS: Record<string, string> = {
  allergy_safety: "Allergy & Safety",
  arrival_logistics: "Arrival Logistics",
  billing_clarity: "Billing Clarity",
  communication_style: "Communication Style",
  emotional_context: "Emotional Context",
  food_beverage: "Food & Beverage",
  housekeeping_style: "Housekeeping Style",
  housekeeping_timing: "Housekeeping Timing",
  privacy_preference: "Privacy Preference",
  sensory_preference: "Sensory Preference",
  service_feedback: "Service Feedback",
  service_style: "Service Style",
  sleep_environment: "Sleep Environment",
  wellness_routine: "Wellness Routine"
};

function privacyVariant(s: GuestSignal["privacySensitivity"]): "default" | "secondary" | "destructive" | "outline" {
  if (s === "high") return "destructive";
  if (s === "medium") return "secondary";
  return "outline";
}

function signalCategoryLabel(category: string): string {
  return (
    SIGNAL_CATEGORY_LABELS[category] ??
    category
      .split("_")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

export function GuestPulseIntakeView() {
  const guests = useMemo(() => guestPulseMockGuests.map((f) => f.guest), []);

  const [guestId, setGuestId] = useState(ELEANOR_ID);
  const [sourceType, setSourceType] = useState<IntakeSourceType>("staff_note");
  const [sourceDepartment, setSourceDepartment] = useState<IntakeDepartment>("fnb");
  const [rawText, setRawText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signals, setSignals] = useState<GuestSignal[] | null>(null);
  const [enrichedProfile, setEnrichedProfile] = useState<EnrichedGuestProfile | null>(null);

  const rawTrimmed = rawText.trim();
  const submitDisabled = !rawTrimmed || loading;

  function loadEleanorBreakfastExample() {
    setGuestId(ELEANOR_ID);
    setSourceType("staff_note");
    setSourceDepartment("fnb");
    setRawText(ELEANOR_BREAKFAST_NOTE);
    setError(null);
    setSignals(null);
    setEnrichedProfile(null);
  }

  function loadAdrianLateArrivalExample() {
    setGuestId(ADRIAN_ID);
    setSourceType("reservation");
    setSourceDepartment("reservations");
    setRawText(ADRIAN_LATE_ARRIVAL_NOTE);
    setError(null);
    setSignals(null);
    setEnrichedProfile(null);
  }

  async function extract() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/guest-pulse/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestId,
          sourceType,
          sourceDepartment,
          rawText: rawTrimmed
        })
      });
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message =
          typeof data === "object" && data !== null && "error" in data && typeof (data as { error: unknown }).error === "string"
            ? (data as { error: string }).error
            : `Request failed (${res.status})`;
        setSignals(null);
        setEnrichedProfile(null);
        setError(message);
        return;
      }
      if (
        typeof data !== "object" ||
        data === null ||
        !("signals" in data) ||
        !("enrichedProfile" in data)
      ) {
        setError("Unexpected response shape");
        setSignals(null);
        setEnrichedProfile(null);
        return;
      }
      setSignals((data as { signals: GuestSignal[] }).signals);
      setEnrichedProfile((data as { enrichedProfile: EnrichedGuestProfile }).enrichedProfile);
    } catch {
      setError("Network error");
      setSignals(null);
      setEnrichedProfile(null);
    } finally {
      setLoading(false);
    }
  }

  const handoffJson =
    signals !== null && enrichedProfile !== null
      ? JSON.stringify({ signals, enrichedProfile }, null, 2)
      : null;

  async function copyHandoff() {
    if (!handoffJson) return;
    try {
      await navigator.clipboard.writeText(handoffJson);
      toast.success("Copied JSON for action pipeline");
    } catch {
      toast.error("Could not copy — select and copy manually");
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 pb-16 lg:p-6">
      <div className="space-y-1">
        <h1 className="font-serif text-2xl font-medium tracking-tight">GuestPulse intake</h1>
        <p className="text-sm text-muted-foreground">
          Paste raw intake text, extract structured signals, and copy the enriched payload for downstream actions.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Intake</CardTitle>
          <CardDescription>Select guest, channel, and department, then paste the note.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="gp-guest">Guest</Label>
              <Select value={guestId} onValueChange={setGuestId}>
                <SelectTrigger id="gp-guest" className="w-full">
                  <SelectValue placeholder="Guest" />
                </SelectTrigger>
                <SelectContent>
                  {guests.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {guestDisplayName(g)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col justify-end gap-2 sm:flex-row sm:flex-wrap sm:items-end">
              <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={loadEleanorBreakfastExample}>
                Load Eleanor breakfast example
              </Button>
              <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={loadAdrianLateArrivalExample}>
                Load Adrian late arrival example
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="gp-source">Intake source</Label>
              <Select value={sourceType} onValueChange={(v) => setSourceType(v as IntakeSourceType)}>
                <SelectTrigger id="gp-source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="gp-dept">Department</Label>
              <Select value={sourceDepartment} onValueChange={(v) => setSourceDepartment(v as IntakeDepartment)}>
                <SelectTrigger id="gp-dept">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENT_OPTIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="gp-raw">Raw intake text</Label>
            <Textarea
              id="gp-raw"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste CRS notes, staff observation, survey text…"
              rows={8}
              className="min-h-[160px] font-mono text-sm"
            />
            {!rawTrimmed ? (
              <p className="text-xs text-muted-foreground">Extract Signals stays disabled until there is non-empty text.</p>
            ) : null}
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <Button type="button" onClick={extract} disabled={submitDisabled} className="gap-2">
            {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Extract Signals
          </Button>
        </CardContent>
      </Card>

      {signals !== null ? (
        <Card>
          <CardHeader>
            <CardTitle>Extracted signals</CardTitle>
            <CardDescription>Evidence, confidence, and privacy sensitivity for each signal.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {signals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No signals returned for this text.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Category</th>
                      <th className="px-3 py-2 font-medium">Value</th>
                      <th className="px-3 py-2 font-medium">Evidence</th>
                      <th className="px-3 py-2 font-medium">Conf.</th>
                      <th className="px-3 py-2 font-medium">Privacy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {signals.map((s) => (
                      <tr key={s.id} className="border-b last:border-0">
                        <td className="px-3 py-2 align-top font-medium">{signalCategoryLabel(s.category)}</td>
                        <td className="px-3 py-2 align-top">{s.value}</td>
                        <td className="max-w-[280px] px-3 py-2 align-top text-muted-foreground">{s.evidence}</td>
                        <td className="whitespace-nowrap px-3 py-2 align-top tabular-nums">
                          {Math.round(s.confidence * 100)}%
                        </td>
                        <td className="px-3 py-2 align-top">
                          <Badge variant={privacyVariant(s.privacySensitivity)}>{s.privacySensitivity}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {enrichedProfile !== null ? (
        <Card>
          <CardHeader>
            <CardTitle>Enriched guest profile</CardTitle>
            <CardDescription>Merged identity, stay context, and profile summary after this intake.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">
                {enrichedProfile.identity.preferredName ?? enrichedProfile.identity.firstName}{" "}
                {enrichedProfile.identity.lastName}
              </span>
              <Badge variant="outline">{enrichedProfile.status.replace(/_/g, " ")}</Badge>
              <span className="text-muted-foreground">{enrichedProfile.segment}</span>
            </div>
            <p>{enrichedProfile.summary}</p>
            <p className="text-xs text-muted-foreground">
              {enrichedProfile.signals.length} signal{enrichedProfile.signals.length === 1 ? "" : "s"} in profile
              {enrichedProfile.lastUpdatedAt
                ? ` · updated ${new Date(enrichedProfile.lastUpdatedAt).toLocaleString()}`
                : null}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {enrichedProfile !== null ? (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
            <div className="space-y-1">
              <CardTitle>Handoff JSON</CardTitle>
              <CardDescription>
                Same shape as the API response: <code className="text-xs">signals</code> +{" "}
                <code className="text-xs">enrichedProfile</code>.
              </CardDescription>
            </div>
            <Button type="button" variant="secondary" size="sm" className="gap-2 shrink-0" onClick={copyHandoff} disabled={!handoffJson}>
              <ClipboardCopy className="size-4" />
              Copy JSON
            </Button>
          </CardHeader>
          <CardContent>
            {handoffJson ? (
              <pre className="max-h-[min(480px,50vh)] overflow-auto rounded-md border bg-muted/30 p-4 text-xs leading-relaxed">
                {handoffJson}
              </pre>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
