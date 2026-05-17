"use client";

import { useMemo, useState } from "react";
import { Clipboard, FilePlus2, Filter, Mic2, Search, Ticket, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CategoryChip } from "@/components/app/CategoryChip";
import { PriorityBadge } from "@/components/app/PriorityBadge";
import { CATEGORY_META, CATEGORY_ORDER, PRIORITY_ORDER } from "@/lib/categories";
import { formatAge, formatShortDate, guestDisplayName, titleCase } from "@/lib/format";
import { makeClientId } from "@/lib/id";
import { selectVoiceMemos } from "@/lib/store/selectors";
import { useGuestCrm } from "@/lib/store/store-context";
import type { PreferenceCategory, TicketCategory, TicketPriority, VoiceNoteMemo, VoiceNoteMemoStatus } from "@/lib/types";

const PREFERENCE_CATEGORIES: PreferenceCategory[] = ["dining", "room", "wellness", "service", "accessibility", "security", "occasion"];
const MEMO_STATUSES: VoiceNoteMemoStatus[] = ["unfiled", "filed", "attached", "archived"];

export function VoiceNotesView() {
  const { state, dispatch } = useGuestCrm();
  const [search, setSearch] = useState("");
  const [guestId, setGuestId] = useState<string>("all");
  const [priority, setPriority] = useState<TicketPriority | "all">("all");
  const [status, setStatus] = useState<VoiceNoteMemoStatus | "all">("all");
  const [preferenceCategory, setPreferenceCategory] = useState<PreferenceCategory | "all">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [fileTargets, setFileTargets] = useState<Record<string, string>>({});
  const category = state.categoryFocus;

  const memos = useMemo(
    () =>
      selectVoiceMemos(state, {
        search,
        guestId,
        category,
        priority,
        status,
        preferenceCategory,
        from,
        to
      }),
    [category, from, guestId, preferenceCategory, priority, search, state, status, to]
  );

  const guestsById = useMemo(() => new Map(state.guests.map((guest) => [guest.id, guest])), [state.guests]);
  const openMemoCount = state.voiceMemos.filter((memo) => memo.status !== "archived").length;
  const unfiledCount = state.voiceMemos.filter((memo) => memo.status === "unfiled").length;
  const signalCount = state.voiceMemos.reduce((total, memo) => total + memo.signalCount, 0);

  async function copyTranscript(memo: VoiceNoteMemo) {
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
    toast.success("Voice memo filed", { description: "A ticket and preference evidence were linked to the guest profile." });
  }

  return (
    <div className="space-y-6 px-safe py-4 md:px-8 md:py-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Walkie archive</p>
          <h1 className="display-1">Voice Memos</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Transcribed walkie notes, auto-routed categories, and GuestPulse preference evidence in one operational inbox.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 rounded-lg border bg-background/70 p-2 text-center">
          <Metric label="memos" value={openMemoCount} />
          <Metric label="unfiled" value={unfiledCount} />
          <Metric label="signals" value={signalCount} />
        </div>
      </header>

      <section className="grid gap-3 rounded-lg border bg-background/70 p-3 lg:grid-cols-[minmax(220px,1.4fr)_repeat(5,minmax(140px,1fr))]">
        <label className="grid gap-1.5 lg:col-span-2">
          <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            <Search className="size-3.5" />
            Search
          </span>
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Transcript, memo title, category..." />
        </label>
        <FilterSelect label="Guest" value={guestId} onValueChange={setGuestId}>
          <SelectItem value="all">All guests</SelectItem>
          {state.guests.map((guest) => (
            <SelectItem key={guest.id} value={guest.id}>
              {guestDisplayName(guest)}
            </SelectItem>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Category"
          value={category}
          onValueChange={(value) => dispatch({ type: "SET_CATEGORY_FOCUS", payload: { category: value as TicketCategory | "all" } })}
        >
          <SelectItem value="all">All categories</SelectItem>
          {CATEGORY_ORDER.map((item) => (
            <SelectItem key={item} value={item}>
              {CATEGORY_META[item].label}
            </SelectItem>
          ))}
        </FilterSelect>
        <FilterSelect label="Priority" value={priority} onValueChange={(value) => setPriority(value as TicketPriority | "all")}>
          <SelectItem value="all">All priorities</SelectItem>
          {PRIORITY_ORDER.map((item) => (
            <SelectItem key={item} value={item}>
              {titleCase(item)}
            </SelectItem>
          ))}
        </FilterSelect>
        <FilterSelect label="Status" value={status} onValueChange={(value) => setStatus(value as VoiceNoteMemoStatus | "all")}>
          <SelectItem value="all">All statuses</SelectItem>
          {MEMO_STATUSES.map((item) => (
            <SelectItem key={item} value={item}>
              {titleCase(item)}
            </SelectItem>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Preference"
          value={preferenceCategory}
          onValueChange={(value) => setPreferenceCategory(value as PreferenceCategory | "all")}
        >
          <SelectItem value="all">All signals</SelectItem>
          {PREFERENCE_CATEGORIES.map((item) => (
            <SelectItem key={item} value={item}>
              {titleCase(item)}
            </SelectItem>
          ))}
        </FilterSelect>
        <label className="grid gap-1.5">
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">From</span>
          <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">To</span>
          <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>
      </section>

      <section className="space-y-3">
        {memos.length === 0 ? (
          <div className="rounded-lg border bg-background/70 p-8 text-center">
            <Mic2 className="mx-auto size-8 text-muted-foreground" />
            <h2 className="mt-3 font-serif text-2xl">No voice memos match</h2>
            <p className="mt-1 text-sm text-muted-foreground">Adjust filters or save a walkie note from the radio panel.</p>
          </div>
        ) : (
          memos.map((memo) => (
            <article key={memo.id} className="rounded-lg border bg-background/75 p-4 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{formatMemoStatus(memo.status)}</Badge>
                    <PriorityBadge priority={memo.priority} />
                    <span className="font-mono text-xs text-muted-foreground">
                      {formatShortDate(memo.createdAt)} · {formatAge(memo.createdAt)}
                    </span>
                  </div>
                  <h2 className="mt-2 font-serif text-2xl font-medium leading-tight">{memo.title}</h2>
                  <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{memo.transcript}</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <CategoryChip category={memo.category} count={memo.signalCount} priorityPeak={memo.priority} />
                  <Badge variant="secondary">{Math.round(memo.routeConfidence * 100)}% confidence</Badge>
                </div>
              </div>

              <div className="mt-4 grid gap-3 border-t pt-3 md:grid-cols-[1fr_auto] md:items-center">
                <div className="flex flex-wrap gap-2 text-sm">
                  {memo.guestId && guestsById.has(memo.guestId) ? (
                    <Badge variant="outline">
                      <UserRound className="size-3.5" />
                      {guestDisplayName(guestsById.get(memo.guestId)!)}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Unfiled</Badge>
                  )}
                  {memo.ticketId ? (
                    <Badge variant="outline">
                      <Ticket className="size-3.5" />
                      {memo.ticketId}
                    </Badge>
                  ) : null}
                  {memo.preferenceCategories.map((item) => (
                    <Badge key={item} variant="champagne">
                      {titleCase(item)}
                    </Badge>
                  ))}
                </div>

                <div className="grid gap-2 sm:flex sm:flex-wrap sm:justify-end">
                  {memo.status === "unfiled" && memo.unfiledVoiceNoteId ? (
                    <div className="grid gap-2 sm:flex">
                      <Select
                        value={fileTargets[memo.id]}
                        onValueChange={(value) => setFileTargets((current) => ({ ...current, [memo.id]: value }))}
                      >
                        <SelectTrigger className="min-h-10 sm:w-52">
                          <SelectValue placeholder="File to guest" />
                        </SelectTrigger>
                        <SelectContent>
                          {state.guests.map((guest) => (
                            <SelectItem key={guest.id} value={guest.id}>
                              {guestDisplayName(guest)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button type="button" onClick={() => fileMemo(memo)} disabled={!fileTargets[memo.id]} className="min-h-10">
                        <FilePlus2 className="size-4" />
                        File
                      </Button>
                    </div>
                  ) : null}
                  {memo.guestId ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => dispatch({ type: "OPEN_GUEST_DETAIL", payload: { guestId: memo.guestId!, ticketId: memo.ticketId } })}
                      className="min-h-10"
                    >
                      <UserRound className="size-4" />
                      Guest
                    </Button>
                  ) : null}
                  {memo.guestId ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => dispatch({ type: "OPEN_NEW_TICKET", payload: { guestId: memo.guestId, category: memo.category } })}
                      className="min-h-10"
                    >
                      <Ticket className="size-4" />
                      Ticket
                    </Button>
                  ) : null}
                  <Button type="button" variant="ghost" onClick={() => void copyTranscript(memo)} className="min-h-10">
                    <Clipboard className="size-4" />
                    Copy
                  </Button>
                </div>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-20 px-2">
      <div className="font-mono text-lg font-semibold tabular-nums">{value}</div>
      <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onValueChange,
  children
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
        <Filter className="size-3.5" />
        {label}
      </Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </div>
  );
}

function formatMemoStatus(status: VoiceNoteMemoStatus) {
  if (status === "unfiled") return "Unfiled";
  if (status === "attached") return "Attached";
  if (status === "archived") return "Archived";
  return "Filed";
}
