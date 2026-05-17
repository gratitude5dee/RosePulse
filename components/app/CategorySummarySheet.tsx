"use client";

import { useMemo } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { Clipboard, Mic2, Ticket as TicketIcon, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PriorityBadge } from "@/components/app/PriorityBadge";
import { StatusPill } from "@/components/app/StatusPill";
import { CATEGORY_META } from "@/lib/categories";
import { formatAge, guestDisplayName, titleCase } from "@/lib/format";
import {
  selectCategoryOperations,
  selectCategoryWorkItems,
  selectGuestById,
  type CategoryWorkItem
} from "@/lib/store/selectors";
import { useGuestCrm } from "@/lib/store/store-context";
import type { GuestCrmState, TicketCategory, VoiceNoteMemoStatus } from "@/lib/types";

export function CategorySummarySheet({
  category,
  open,
  onOpenChange,
  railWidth = "64px",
  sidebarWidth = "260px"
}: {
  category?: TicketCategory;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  railWidth?: string;
  sidebarWidth?: string;
}) {
  const { state, dispatch } = useGuestCrm();
  const router = useRouter();
  const summary = useMemo(
    () => (category ? selectCategoryOperations(state).find((item) => item.category === category) : undefined),
    [category, state]
  );
  const workItems = useMemo(() => (category ? selectCategoryWorkItems(state, category) : []), [category, state]);

  if (!category) return null;

  const meta = CATEGORY_META[category];
  const Icon = meta.Icon;

  function openItem(item: CategoryWorkItem) {
    if (item.type === "ticket") {
      dispatch({ type: "OPEN_GUEST_DETAIL", payload: { guestId: item.guestId, ticketId: item.id } });
      onOpenChange(false);
      return;
    }

    if (item.guestId) {
      dispatch({ type: "OPEN_GUEST_DETAIL", payload: { guestId: item.guestId, ticketId: item.ticketId } });
      onOpenChange(false);
      return;
    }

    router.push("/voice-notes");
    onOpenChange(false);
  }

  async function copyMemo(item: CategoryWorkItem) {
    if (item.type !== "memo") return;
    await navigator.clipboard?.writeText(item.transcript);
    toast.success("Voice memo copied");
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        style={{ "--category-dock-rail-width": railWidth, "--category-sidebar-width": sidebarWidth } as CSSProperties}
        className="max-h-[calc(100dvh-var(--safe-top))] overflow-y-auto rounded-t-xl border bg-background/95 p-4 pb-[max(var(--safe-bottom),1rem)] backdrop-blur-xl md:left-[calc(var(--category-sidebar-width,260px)+1rem)] md:right-4 md:mx-auto md:max-w-4xl lg:right-[calc(var(--category-dock-rail-width,64px)+1rem)]"
      >
        <SheetHeader className="pr-8">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-full border bg-background">
              <Icon className="size-4" style={{ color: `var(${meta.colorVar})` }} />
            </span>
            <div>
              <SheetTitle>{meta.label}</SheetTitle>
              <SheetDescription>Tickets and voice memos ordered by operational importance.</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Metric label="urgent" value={summary?.urgentCount ?? 0} />
          <Metric label="high" value={summary?.highCount ?? 0} />
          <Metric label="tickets" value={summary?.activeTicketCount ?? 0} />
          <Metric label="memos" value={summary?.activeMemoCount ?? 0} />
          <Metric label="unfiled" value={summary?.unfiledMemoCount ?? 0} />
        </div>

        <div className="mt-5 space-y-2">
          {workItems.length === 0 ? (
            <div className="rounded-lg border bg-secondary/30 p-5 text-sm text-muted-foreground">
              No active tickets or voice memos in {meta.label}.
            </div>
          ) : (
            workItems.slice(0, 16).map((item) => (
              <WorkItemRow
                key={`${item.type}-${item.id}`}
                item={item}
                guestName={item.guestId ? guestNameFor(state, item.guestId) : undefined}
                onOpen={() => openItem(item)}
                onCopy={item.type === "memo" ? () => void copyMemo(item) : undefined}
              />
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-background/70 px-3 py-2 text-center">
      <div className="font-mono text-xl font-semibold tabular-nums">{value}</div>
      <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
    </div>
  );
}

function WorkItemRow({
  item,
  guestName,
  onOpen,
  onCopy
}: {
  item: CategoryWorkItem;
  guestName?: string;
  onOpen: () => void;
  onCopy?: () => void;
}) {
  return (
    <article className="rounded-lg border bg-background/78 p-3 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={item.type === "ticket" ? "secondary" : "outline"}>
              {item.type === "ticket" ? <TicketIcon className="size-3.5" /> : <Mic2 className="size-3.5" />}
              {item.type === "ticket" ? "Ticket" : "Memo"}
            </Badge>
            <PriorityBadge priority={item.priority} />
            {item.type === "ticket" ? <StatusPill status={item.status} /> : <MemoStatus status={item.status} />}
            <span className="font-mono text-xs text-muted-foreground">{formatAge(item.activityAt)}</span>
          </div>
          <h3 className="mt-2 truncate text-sm font-semibold">{item.title}</h3>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {guestName ? `${guestName} · ` : ""}
            {item.type === "memo" ? item.transcript : item.ticket.detail}
          </p>
        </button>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" className="min-h-10" onClick={onOpen}>
            <UserRound className="size-4" />
            Open
          </Button>
          {onCopy ? (
            <Button type="button" variant="ghost" size="sm" className="min-h-10" onClick={onCopy}>
              <Clipboard className="size-4" />
              Copy
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function MemoStatus({ status }: { status: VoiceNoteMemoStatus }) {
  return (
    <Badge variant={status === "unfiled" ? "champagne" : "secondary"}>
      {titleCase(status)}
    </Badge>
  );
}

function guestNameFor(state: GuestCrmState, guestId: string) {
  const guest = selectGuestById(state, guestId);
  return guest ? guestDisplayName(guest) : undefined;
}
