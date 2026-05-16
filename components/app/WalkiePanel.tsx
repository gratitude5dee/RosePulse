"use client";

import { useEffect, useMemo, useState } from "react";
import { Clipboard, Mic, MicOff, Radio, RotateCcw, Save, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Waveform } from "@/components/app/Waveform";
import { CATEGORY_META, CATEGORY_ORDER, PRIORITY_META, PRIORITY_ORDER } from "@/lib/categories";
import { classifyTranscript } from "@/lib/transcript-classifier";
import { guestDisplayName, transcriptTitle } from "@/lib/format";
import { selectTicketsByGuest } from "@/lib/store/selectors";
import { useGuestCrm } from "@/lib/store/store-context";
import type { TicketCategory, TicketPriority } from "@/lib/types";
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

  const transcript = walkie.supported ? walkie.transcript : typedFallback;

  useEffect(() => {
    if (!categoryTouched && transcript.trim()) {
      setCategory(classifyTranscript(transcript).category);
    }
  }, [categoryTouched, transcript]);

  function handleCategoryChange(value: TicketCategory) {
    setCategoryTouched(true);
    setCategory(value);
  }

  function pointerDown() {
    if (walkie.supported) {
      void walkie.start();
    }
  }

  function pointerUp() {
    if (walkie.supported) {
      walkie.stop();
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.code === "Space" && !walkie.isRecording && walkie.supported) {
      event.preventDefault();
      void walkie.start();
    }
    if (event.key === "Escape" && walkie.isRecording) {
      walkie.stop();
    }
  }

  function handleKeyUp(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.code === "Space" && walkie.isRecording && walkie.supported) {
      event.preventDefault();
      walkie.stop();
    }
  }

  function discard() {
    walkie.clearTranscript();
    setTypedFallback("");
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

    if (guestId === "unfiled") {
      dispatch({ type: "ADD_UNFILED_NOTE", payload: { transcript: clean, category, priority } });
      toast.success("Saved to Unfiled", { description: "File it to a guest when ready." });
    } else if (ticketId !== "new") {
      dispatch({ type: "ADD_VOICE_NOTE", payload: { ticketId, transcript: clean } });
      toast.success("Voice note attached");
    } else {
      dispatch({
        type: "CREATE_TICKET",
        payload: {
          guestId,
          category,
          priority,
          title: transcriptTitle(clean),
          detail: clean,
          voiceNote: true
        }
      });
      toast.success("Voice ticket created");
    }

    walkie.clearTranscript();
    setTypedFallback("");
  }

  const isFull = variant === "full";
  const statusText = walkie.isRecording ? "Listening..." : transcript ? "Paused" : "Stopped";

  return (
    <section
      data-tier="frosted"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      className={cn(
        "flex h-full flex-col rounded-lg p-4 outline-none",
        isFull ? "min-h-[calc(100dvh-7rem)]" : "min-h-[calc(100dvh-6rem)]"
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

      <div className={cn("grid gap-3 py-4", isFull ? "md:grid-cols-4" : "grid-cols-1")}>
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
          <Select value={priority} onValueChange={(value) => setPriority(value as TicketPriority)}>
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
            Microphone access is blocked. Allow microphone access in the browser, then try again.
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
          disabled={!walkie.supported}
          className={cn(
            "relative flex shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_18px_60px_oklch(0.32_0.04_40/0.26)] transition-transform",
            isFull ? "size-[168px]" : "size-24",
            walkie.isRecording && "animate-recording-pulse",
            !walkie.supported && "opacity-50"
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
          <p className="mt-1 text-xs text-muted-foreground">Space works while this panel is focused.</p>
        </div>
        <Waveform level={walkie.audioLevel} className={isFull ? "w-full max-w-lg" : "w-full"} />
      </div>

      <div className="space-y-3 border-t pt-4">
        <div className="rounded-md bg-background/65 p-3">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>Live transcript</span>
            <span>{new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
          </div>
          {walkie.supported ? (
            <div aria-live="polite" className="min-h-24 space-y-2 font-mono text-sm">
              {walkie.segments.map((segment) => (
                <p key={segment.id}>{segment.text}</p>
              ))}
              {walkie.interimTranscript ? <p className="italic text-muted-foreground">{walkie.interimTranscript}</p> : null}
              {!transcript ? <p className="text-muted-foreground">Transcript will appear here.</p> : null}
            </div>
          ) : (
            <Textarea
              value={typedFallback}
              onChange={(event) => setTypedFallback(event.target.value)}
              aria-label="Voice unavailable in this browser - type your note"
              placeholder="Voice unavailable in this browser - type your note"
            />
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={save} className="flex-1">
            <Save className="size-4" />
            Save as voice note
          </Button>
          <Button variant="outline" onClick={discard}>
            <RotateCcw className="size-4" />
            Discard
          </Button>
          <Button variant="ghost" onClick={() => void copyTranscript()}>
            <Clipboard className="size-4" />
            Copy
          </Button>
          {guestId !== "unfiled" ? (
            <Button
              variant="ghost"
              onClick={() => dispatch({ type: "OPEN_NEW_TICKET", payload: { guestId, category } })}
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
