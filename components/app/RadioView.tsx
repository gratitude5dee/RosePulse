"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { Clipboard, FilePlus2, Mic2, Radio as RadioIcon, Sparkles, Ticket, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PriorityBadge } from "@/components/app/PriorityBadge";
import { CATEGORY_META } from "@/lib/categories";
import { formatAge, formatShortDate, guestDisplayName } from "@/lib/format";
import { makeClientId } from "@/lib/id";
import { selectAttentionQueue, selectGuestById, selectRecentVoiceMemos, selectShiftHandoff } from "@/lib/store/selectors";
import { useGuestCrm } from "@/lib/store/store-context";
import type { GuestCrmState, VoiceNoteMemo } from "@/lib/types";

const WalkiePanel = dynamic(() => import("@/components/app/WalkiePanel").then((mod) => mod.WalkiePanel), {
  ssr: false,
  loading: () => <div className="rounded-lg border bg-background/72 p-6 text-sm text-muted-foreground">Loading radio...</div>
});

export function RadioView() {
  const { state, dispatch } = useGuestCrm();
  const [fileTargets, setFileTargets] = useState<Record<string, string>>({});
  const memos = useMemo(() => selectRecentVoiceMemos(state, 10), [state]);
  const handoff = useMemo(() => selectShiftHandoff(state), [state]);
  const attention = useMemo(() => selectAttentionQueue(state), [state]);

  async function copyMemo(memo: VoiceNoteMemo) {
    await navigator.clipboard?.writeText(memo.transcript);
    toast.success("Transcript copied");
  }

  function fileMemo(memo: VoiceNoteMemo) {
    const targetGuestId = fileTargets[memo.id];
    if (!targetGuestId || !memo.unfiledVoiceNoteId) return;
    dispatch({
      type: "FILE_UNFILED_NOTE",
      payload: {
        noteId: memo.unfiledVoiceNoteId,
        memoId: memo.id,
        guestId: targetGuestId,
        ticketId: makeClientId("t"),
        createdEventId: makeClientId("e"),
        voiceNoteEventId: makeClientId("e"),
        priority: memo.priority,
        intelligence: memo.intelligence,
        memoMetadata: {
          analysisProvider: memo.analysisProvider,
          analysisModel: memo.analysisModel,
          analysisVersion: memo.analysisVersion,
          analysisStatus: memo.analysisStatus,
          analysisError: memo.analysisError,
          transcriptionModel: memo.transcriptionModel,
          durationSeconds: memo.durationSeconds,
          transcribedAt: memo.transcribedAt
        }
      }
    });
    toast.success("Voice memo filed");
  }

  return (
    <div className="px-safe py-6 pb-[max(var(--safe-bottom),1.5rem)] md:px-8">
      <div className="mb-5">
        <h1 className="display-1">Radio</h1>
        <p className="text-sm text-muted-foreground">Push-to-talk filing, live memo history, and shift-level handoff context.</p>
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <WalkiePanel variant="full" />
        <aside className="space-y-4">
          <section className="rounded-lg border bg-background/72 p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-serif text-2xl font-medium">Shift handoff</h2>
                <p className="text-xs text-muted-foreground">Since {formatShortDate(handoff.since)}</p>
              </div>
              <Badge variant="champagne">{attention.length} watch</Badge>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Metric label="urgent" value={handoff.urgentTickets.length} />
              <Metric label="unfiled" value={handoff.unfiledMemos.length} />
              <Metric label="signals" value={handoff.newPreferences.length} />
            </div>
          </section>

          <section className="rounded-lg border bg-background/72 p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <RadioIcon className="size-4 text-primary" />
              <h2 className="font-serif text-2xl font-medium">Recent voice memos</h2>
            </div>
            <div className="space-y-3">
              {memos.length === 0 ? (
                <p className="rounded-md bg-secondary/40 p-3 text-sm text-muted-foreground">No memos saved yet.</p>
              ) : (
                memos.map((memo) => (
                  <MemoHistoryCard
                    key={memo.id}
                    memo={memo}
                    guestName={memo.guestId ? guestNameFor(state, memo.guestId) : undefined}
                    fileTarget={fileTargets[memo.id]}
                    guests={state.guests}
                    onFileTargetChange={(guestId) => setFileTargets((current) => ({ ...current, [memo.id]: guestId }))}
                    onFile={() => fileMemo(memo)}
                    onCopy={() => void copyMemo(memo)}
                    onOpenGuest={() => {
                      if (memo.guestId) dispatch({ type: "OPEN_GUEST_DETAIL", payload: { guestId: memo.guestId, ticketId: memo.ticketId } });
                    }}
                    onCreateTicket={() => dispatch({ type: "OPEN_NEW_TICKET", payload: { guestId: memo.guestId, category: memo.category } })}
                  />
                ))
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-background/70 px-2 py-2">
      <div className="font-mono text-lg font-semibold">{value}</div>
      <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
    </div>
  );
}

function MemoHistoryCard({
  memo,
  guestName,
  guests,
  fileTarget,
  onFileTargetChange,
  onFile,
  onCopy,
  onOpenGuest,
  onCreateTicket
}: {
  memo: VoiceNoteMemo;
  guestName?: string;
  guests: Array<{ id: string; firstName: string; lastName: string; preferredName?: string }>;
  fileTarget?: string;
  onFileTargetChange: (guestId: string) => void;
  onFile: () => void;
  onCopy: () => void;
  onOpenGuest: () => void;
  onCreateTicket: () => void;
}) {
  const meta = CATEGORY_META[memo.category];
  const Icon = meta.Icon;
  return (
    <article className="rounded-lg border bg-background/78 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={memo.status === "unfiled" ? "champagne" : "secondary"}>
          <Mic2 className="size-3.5" />
          {memo.status}
        </Badge>
        <PriorityBadge priority={memo.priority} />
        <Badge variant="outline">
          <Icon className="size-3.5" style={{ color: `var(${meta.colorVar})` }} />
          {meta.label}
        </Badge>
        <span className="ml-auto font-mono text-xs text-muted-foreground">{formatAge(memo.createdAt)}</span>
      </div>
      <h3 className="mt-2 line-clamp-1 text-sm font-semibold">{memo.title}</h3>
      <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{memo.transcript}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{formatShortDate(memo.createdAt)}</span>
        {guestName ? <span>{guestName}</span> : <span>Unfiled</span>}
        {memo.signalCount > 0 ? (
          <Badge variant="champagne">
            <Sparkles className="size-3" />
            {memo.signalCount} signals
          </Badge>
        ) : null}
      </div>
      <div className="mt-3 grid gap-2">
        {memo.status === "unfiled" && memo.unfiledVoiceNoteId ? (
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <Select value={fileTarget} onValueChange={onFileTargetChange}>
              <SelectTrigger className="min-h-10">
                <SelectValue placeholder="File to guest" />
              </SelectTrigger>
              <SelectContent>
                {guests.map((guest) => (
                  <SelectItem key={guest.id} value={guest.id}>
                    {guest.preferredName ?? `${guest.firstName} ${guest.lastName}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" onClick={onFile} disabled={!fileTarget} className="min-h-10">
              <FilePlus2 className="size-4" />
              File
            </Button>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {memo.guestId ? (
            <Button type="button" variant="outline" size="sm" className="min-h-10" onClick={onOpenGuest}>
              <UserRound className="size-4" />
              Guest
            </Button>
          ) : null}
          <Button type="button" variant="outline" size="sm" className="min-h-10" onClick={onCreateTicket}>
            <Ticket className="size-4" />
            Ticket
          </Button>
          <Button type="button" variant="ghost" size="sm" className="min-h-10" onClick={onCopy}>
            <Clipboard className="size-4" />
            Copy
          </Button>
        </div>
      </div>
    </article>
  );
}

function guestNameFor(state: GuestCrmState, guestId: string) {
  const guest = selectGuestById(state, guestId);
  return guest ? guestDisplayName(guest) : undefined;
}
