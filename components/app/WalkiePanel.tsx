"use client";

import { useEffect, useMemo, useState } from "react";
import { Clipboard, Mic, MicOff, Radio, RotateCcw, Save, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Waveform } from "@/components/app/Waveform";
import { CATEGORY_META, CATEGORY_ORDER, PRIORITY_META, PRIORITY_ORDER } from "@/lib/categories";
import { guestDisplayName, transcriptTitle } from "@/lib/format";
import { makeClientId } from "@/lib/id";
import { selectTicketsByGuest } from "@/lib/store/selectors";
import { useGuestCrm } from "@/lib/store/store-context";
import type { TicketCategory, TicketPriority, WalkieIntelligence } from "@/lib/types";
import { useWalkie } from "@/hooks/use-walkie";
import { cn } from "@/lib/utils";

export function WalkiePanel({ variant = "docked" }: { variant?: "docked" | "full" }) {
  const { state, dispatch } = useGuestCrm();
  const [guestId, setGuestId] = useState<string>(state.focusedGuestId ?? "unfiled");
  const [ticketId, setTicketId] = useState<string>("new");
  const [category, setCategory] = useState<TicketCategory>("guest_relations");
  const [priority, setPriority] = useState<TicketPriority>("medium");
  const [typedFallback, setTypedFallback] = useState("");
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [priorityTouched, setPriorityTouched] = useState(false);
  const [intelligence, setIntelligence] = useState<WalkieIntelligence | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const walkie = useWalkie({
    onAutoStop: () => toast.warning("Walkie auto-stopped", { description: "Release and re-engage to continue." })
  });

  useEffect(() => {
    if (state.focusedGuestId) {
      setGuestId(state.focusedGuestId);
    }
  }, [state.focusedGuestId]);

  const guestTickets = useMemo(
    () => (guestId === "unfiled" ? [] : selectTicketsByGuest(state, guestId).filter((ticket) => ticket.status !== "resolved")),
    [guestId, state]
  );

  const serverTranscriptionMode = !walkie.speechSupported && walkie.serverTranscriptionSupported;
  const typedMode =
    walkie.permissionState === "denied" ||
    walkie.permissionState === "unsupported" ||
    (!walkie.speechSupported && !walkie.serverTranscriptionSupported) ||
    (!walkie.transcript.trim() && Boolean(walkie.transcriptionError));
  const transcript = typedFallback.trim() || walkie.transcript;
  const micUnavailable = walkie.permissionState === "unsupported" || !walkie.micSupported;

  useEffect(() => {
    const clean = transcript.trim();
    if (!clean) {
      setIntelligence(null);
      setAnalysisError(null);
      setIsAnalyzing(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setIsAnalyzing(true);
      setAnalysisError(null);
      void fetch("/api/walkie/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: clean,
          guestId: guestId === "unfiled" ? undefined : guestId,
          ticketId: ticketId === "new" ? undefined : ticketId
        }),
        signal: controller.signal
      })
        .then(async (response) => {
          const data: unknown = await response.json().catch(() => null);
          if (!response.ok) {
            const message =
              data && typeof data === "object" && "error" in data && typeof data.error === "string"
                ? data.error
                : "Walkie analysis failed";
            throw new Error(message);
          }
          if (!isWalkieIntelligence(data)) {
            throw new Error("Walkie analysis returned an unexpected response.");
          }
          setIntelligence(data);
          if (ticketId === "new") {
            if (!categoryTouched) setCategory(data.category);
            if (!priorityTouched) setPriority(data.priority);
          }
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setIntelligence(null);
          setAnalysisError(error instanceof Error ? error.message : "Walkie analysis failed");
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsAnalyzing(false);
        });
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [categoryTouched, guestId, priorityTouched, ticketId, transcript]);

  function handleCategoryChange(value: TicketCategory) {
    setCategoryTouched(true);
    setCategory(value);
  }

  function handlePriorityChange(value: TicketPriority) {
    setPriorityTouched(true);
    setPriority(value);
  }

  function pointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      void 0;
    }
    if (!micUnavailable && !walkie.isTranscribing) {
      void walkie.start();
    }
  }

  function pointerUp(event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      void 0;
    }
    if (!micUnavailable) {
      walkie.stop();
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.code === "Space" && !walkie.isRecording && !micUnavailable && !walkie.isTranscribing) {
      event.preventDefault();
      void walkie.start();
    }
    if (event.key === "Escape" && walkie.isRecording) {
      walkie.stop();
    }
  }

  function handleKeyUp(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.code === "Space" && walkie.isRecording && !micUnavailable) {
      event.preventDefault();
      walkie.stop();
    }
  }

  function discard() {
    walkie.clearTranscript();
    setTypedFallback("");
    setIntelligence(null);
    setAnalysisError(null);
    setCategoryTouched(false);
    setPriorityTouched(false);
    toast.message("Transcript discarded");
  }

  async function copyTranscript() {
    if (!transcript.trim()) return;
    await navigator.clipboard?.writeText(transcript.trim());
    toast.success("Transcript copied");
  }

  function save() {
    const clean = transcript.trim();
    if (!clean) {
      toast.error("No transcript to save");
      return;
    }

    const saveIntelligence = intelligence
      ? {
          ...intelligence,
          category,
          priority,
          title: intelligence.title || transcriptTitle(clean)
        }
      : undefined;
    const memoId = makeClientId("memo");

    if (guestId === "unfiled") {
      dispatch({
        type: "ADD_UNFILED_NOTE",
        payload: {
          noteId: makeClientId("u"),
          memoId,
          transcript: clean,
          category,
          priority,
          intelligence: saveIntelligence
        }
      });
      toast.success("Saved to Unfiled", { description: "File it to a guest when ready." });
    } else if (ticketId !== "new") {
      dispatch({
        type: "ADD_VOICE_NOTE",
        payload: {
          ticketId,
          transcript: clean,
          eventId: makeClientId("e"),
          memoId,
          intelligence: saveIntelligence
        }
      });
      toast.success("Voice note attached", { description: saveIntelligence?.signals.length ? "GuestPulse signals captured." : undefined });
    } else {
      dispatch({
        type: "CREATE_TICKET",
        payload: {
          ticketId: makeClientId("t"),
          createdEventId: makeClientId("e"),
          voiceNoteEventId: makeClientId("e"),
          memoId,
          guestId,
          category,
          priority,
          title: saveIntelligence?.title ?? transcriptTitle(clean),
          detail: clean,
          voiceNote: true,
          intelligence: saveIntelligence
        }
      });
      toast.success("Voice ticket created", { description: saveIntelligence?.signals.length ? "GuestPulse signals captured." : undefined });
    }

    walkie.clearTranscript();
    setTypedFallback("");
    setIntelligence(null);
    setAnalysisError(null);
    setCategoryTouched(false);
    setPriorityTouched(false);
  }

  const isFull = variant === "full";
  const statusText = walkie.isTranscribing
    ? "Transcribing..."
    : isAnalyzing
      ? "Analyzing route..."
    : walkie.isRecording
      ? walkie.speechSupported
        ? "Listening..."
        : "Recording from device mic..."
      : transcript
        ? "Ready to file"
        : "Stopped";

  return (
    <section
      data-tier="frosted"
      tabIndex={0}
      aria-busy={walkie.isTranscribing}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-lg p-4 outline-none",
        isFull ? "min-h-[calc(100dvh-8rem)] pb-[max(var(--safe-bottom),1rem)]" : "min-h-[calc(100dvh-6rem)]"
      )}
    >
      <header className="flex items-start justify-between gap-3 border-b pb-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Radio className="size-4 text-primary" />
            Walkie-Talkie
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Hold to talk. Release to file.</p>
        </div>
        <span className="rounded-full bg-secondary px-2 py-1 font-mono text-xs">{formatElapsed(walkie.elapsedSeconds)}</span>
      </header>

      <div className={cn("grid gap-3 py-4", isFull ? "sm:grid-cols-2 md:grid-cols-4" : "grid-cols-1")}>
        <div className="grid gap-1.5">
          <Label>Guest</Label>
          <Select value={guestId} onValueChange={(value) => setGuestId(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unfiled">Unfiled inbox</SelectItem>
              {state.guests.map((guest) => (
                <SelectItem key={guest.id} value={guest.id}>
                  {guestDisplayName(guest)} {guest.roomNumber ? `- ${guest.roomNumber}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>Ticket</Label>
          <Select value={ticketId} onValueChange={setTicketId} disabled={guestId === "unfiled"}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new">New ticket</SelectItem>
              {guestTickets.map((ticket) => (
                <SelectItem key={ticket.id} value={ticket.id}>
                  {ticket.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>Category</Label>
          <Select value={category} onValueChange={(value) => handleCategoryChange(value as TicketCategory)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_ORDER.map((item) => (
                <SelectItem key={item} value={item}>
                  {CATEGORY_META[item].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>Priority</Label>
          <Select value={priority} onValueChange={(value) => handlePriorityChange(value as TicketPriority)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITY_ORDER.map((item) => (
                <SelectItem key={item} value={item}>
                  {PRIORITY_META[item].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-4">
        {walkie.permissionState === "denied" ? (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
            Microphone access is blocked. On iPhone, open the HTTPS preview in Safari or the installed home-screen app,
            then allow microphone access for this site and try again.
          </div>
        ) : null}
        {micUnavailable ? (
          <div className="rounded-lg border bg-secondary/50 p-4 text-sm text-muted-foreground">
            Microphone capture requires a secure HTTPS context and browser media support. Use Safari over HTTPS or the
            installed home-screen app on iPhone, or type the note below.
          </div>
        ) : null}
        {serverTranscriptionMode && !micUnavailable ? (
          <div className="rounded-lg border bg-secondary/50 p-4 text-sm text-muted-foreground">
            Live captions are unavailable in this browser. Hold the mic to capture from the device microphone, then
            release to transcribe the recording automatically.
          </div>
        ) : null}
        {walkie.transcriptionError ? (
          <div className="flex flex-col gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
            <span>{walkie.transcriptionError}</span>
            <Button
              type="button"
              variant="outline"
              onClick={walkie.retryTranscription}
              disabled={walkie.isTranscribing}
              className="min-h-10 border-destructive/30 bg-background/70 text-destructive hover:bg-destructive/10"
            >
              <RotateCcw className="size-4" />
              Retry
            </Button>
          </div>
        ) : null}

        <button
          type="button"
          aria-pressed={walkie.isRecording}
          aria-label={walkie.isRecording ? "Release to stop recording" : "Hold to talk"}
          onPointerDown={pointerDown}
          onPointerUp={pointerUp}
          onPointerCancel={pointerUp}
          onPointerLeave={pointerUp}
          onContextMenu={(event) => event.preventDefault()}
          disabled={micUnavailable || walkie.isTranscribing}
          className={cn(
            "touch-none select-none relative flex shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_18px_60px_oklch(0.32_0.04_40/0.26)] transition-transform",
            isFull ? "size-[168px]" : "size-24",
            walkie.isRecording && "animate-recording-pulse",
            (micUnavailable || walkie.isTranscribing) && "opacity-50"
          )}
        >
          {walkie.isRecording ? <Mic className={isFull ? "size-14" : "size-9"} /> : <MicOff className={isFull ? "size-14" : "size-9"} />}
          {walkie.isRecording ? (
            <span className="animate-ring-spin absolute -inset-3 rounded-full border-2 border-dashed border-accent" />
          ) : null}
        </button>

        <div className="text-center">
          <p aria-live="polite" className="font-medium">
            {statusText}
          </p>
          <p className="mt-1 hidden text-xs text-muted-foreground md:block">Space works while this panel is focused.</p>
          <p className="mt-1 text-xs text-muted-foreground md:hidden">Touch and hold the mic.</p>
        </div>
        <Waveform level={walkie.audioLevel} className={isFull ? "w-full max-w-lg" : "w-full"} />
      </div>

      <div className="space-y-3 border-t pt-4">
        <div className="rounded-md bg-background/65 p-3">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>Live transcript</span>
            <span>{new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
          </div>
          {!typedMode ? (
            <div aria-live="polite" className="min-h-24 space-y-2 font-mono text-sm">
              {walkie.segments.map((segment) => (
                <p key={segment.id}>{segment.text}</p>
              ))}
              {walkie.interimTranscript ? <p className="italic text-muted-foreground">{walkie.interimTranscript}</p> : null}
              {walkie.isTranscribing ? <p className="italic text-muted-foreground">Transcribing recording...</p> : null}
              {!transcript && !walkie.isTranscribing ? (
                <p className="text-muted-foreground">
                  {serverTranscriptionMode ? "Release the mic to transcribe the recording." : "Transcript will appear here."}
                </p>
              ) : null}
            </div>
          ) : (
            <Textarea
              value={typedFallback}
              onChange={(event) => setTypedFallback(event.target.value)}
              aria-label="Type your note"
              placeholder="Type the note if transcription fails or microphone access is blocked."
              className="min-h-28"
            />
          )}
        </div>

        {isAnalyzing || intelligence || analysisError ? (
          <div className="rounded-md border bg-background/55 p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <span className="font-medium">{isAnalyzing ? "Analyzing GuestPulse signals" : "Auto-routed"}</span>
              {intelligence ? (
                <>
                  <Badge variant="outline">{CATEGORY_META[intelligence.category].label}</Badge>
                  <Badge variant="secondary">{PRIORITY_META[intelligence.priority].label}</Badge>
                  <span className="text-xs text-muted-foreground">{Math.round(intelligence.routeConfidence * 100)}% route confidence</span>
                </>
              ) : null}
              {intelligence && intelligence.routeConfidence < 0.6 ? (
                <Badge variant="secondary">Review category</Badge>
              ) : null}
            </div>
            {analysisError ? <p className="mt-2 text-xs text-destructive">{analysisError}</p> : null}
            {intelligence?.signals.length ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {intelligence.signals.slice(0, 4).map((signal) => (
                  <Badge key={signal.id} variant="champagne" className="max-w-full truncate">
                    {signal.label}
                  </Badge>
                ))}
                {intelligence.signals.length > 4 ? (
                  <Badge variant="outline">+{intelligence.signals.length - 4} more</Badge>
                ) : null}
              </div>
            ) : intelligence && !isAnalyzing ? (
              <p className="mt-2 text-xs text-muted-foreground">No preference signals extracted from this transcript.</p>
            ) : null}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
          <Button onClick={save} disabled={walkie.isTranscribing || isAnalyzing} className="min-h-10 flex-1">
            <Save className="size-4" />
            {walkie.isTranscribing ? "Transcribing..." : isAnalyzing ? "Analyzing..." : "Save as voice note"}
          </Button>
          <Button variant="outline" onClick={discard} className="min-h-10">
            <RotateCcw className="size-4" />
            Discard
          </Button>
          <Button variant="ghost" onClick={() => void copyTranscript()} className="min-h-10">
            <Clipboard className="size-4" />
            Copy
          </Button>
          {guestId !== "unfiled" ? (
            <Button
              variant="ghost"
              onClick={() => dispatch({ type: "OPEN_NEW_TICKET", payload: { guestId, category } })}
              className="min-h-10"
            >
              <Send className="size-4" />
              Ticket
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${remainder.toString().padStart(2, "0")}`;
}

function isWalkieIntelligence(value: unknown): value is WalkieIntelligence {
  return Boolean(
    value &&
      typeof value === "object" &&
      "category" in value &&
      "priority" in value &&
      "title" in value &&
      "routeConfidence" in value &&
      "signals" in value &&
      Array.isArray(value.signals)
  );
}
