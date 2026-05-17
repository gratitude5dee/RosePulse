"use client";

import { useMemo, useState } from "react";
import { ChevronDown, LayoutGrid } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CategorySummarySheet } from "@/components/app/CategorySummarySheet";
import { CATEGORY_META, PRIORITY_META } from "@/lib/categories";
import { selectCategoryOperations } from "@/lib/store/selectors";
import { useGuestCrm } from "@/lib/store/store-context";
import type { CategoryFocus, TicketCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

export function CategoryOperationsNav({
  collapsed,
  onSelect
}: {
  collapsed?: boolean;
  onSelect?: () => void;
}) {
  const { state, dispatch } = useGuestCrm();
  const [sheetCategory, setSheetCategory] = useState<TicketCategory | undefined>();
  const [sheetOpen, setSheetOpen] = useState(false);
  const summaries = selectCategoryOperations(state);
  const totals = useCategoryTotals(summaries);
  const sidebarWidth = collapsed ? "76px" : "260px";

  function setFocus(category: CategoryFocus) {
    dispatch({ type: "SET_CATEGORY_FOCUS", payload: { category } });
    onSelect?.();
    if (category === "all") {
      setSheetOpen(false);
      return;
    }
    setSheetCategory(category);
    setSheetOpen(true);
  }

  if (collapsed) {
    return (
      <>
        <TooltipProvider delayDuration={150}>
          <nav aria-label="Category operations" className="space-y-2">
            <CollapsedOperationButton
              label="All operations"
              active={state.categoryFocus === "all"}
              urgentCount={totals.urgent}
              onClick={() => setFocus("all")}
            >
              <LayoutGrid className="size-4" />
            </CollapsedOperationButton>
            {summaries.map((summary) => {
              const meta = CATEGORY_META[summary.category];
              const Icon = meta.Icon;
              return (
                <CollapsedOperationButton
                  key={summary.category}
                  label={`${meta.label}: ${summary.activeTicketCount} tickets, ${summary.activeMemoCount} memos`}
                  active={state.categoryFocus === summary.category}
                  urgentCount={summary.urgentCount}
                  highCount={summary.highCount}
                  onClick={() => setFocus(summary.category)}
                  accent={meta.colorVar}
                >
                  <Icon className="size-4" />
                </CollapsedOperationButton>
              );
            })}
          </nav>
        </TooltipProvider>
        <CategorySummarySheet
          category={sheetCategory}
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          sidebarWidth={sidebarWidth}
        />
      </>
    );
  }

  return (
    <>
      <section aria-label="Category operations" className="space-y-2">
        <div className="flex items-center justify-between px-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Operations</p>
          <Badge variant="secondary" className="font-mono text-[10px]">
            {totals.tickets + totals.memos}
          </Badge>
        </div>
        <button
          type="button"
          aria-pressed={state.categoryFocus === "all"}
          onClick={() => setFocus("all")}
          className={cn(
            "flex min-h-11 w-full items-center gap-3 rounded-lg border px-3 text-left text-sm transition-colors",
            state.categoryFocus === "all"
              ? "border-primary bg-primary text-primary-foreground shadow-sm"
              : "border-border/70 bg-background/42 hover:bg-secondary/70"
          )}
        >
          <span className={cn("flex size-8 items-center justify-center rounded-full", state.categoryFocus === "all" ? "bg-primary-foreground/14" : "bg-secondary")}>
            <LayoutGrid className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium">All operations</span>
            <span className={cn("block font-mono text-[11px]", state.categoryFocus === "all" ? "text-primary-foreground/78" : "text-muted-foreground")}>
              {totals.tickets} tickets · {totals.memos} memos
            </span>
          </span>
          {totals.urgent > 0 ? <Badge variant={state.categoryFocus === "all" ? "secondary" : "champagne"}>{totals.urgent}u</Badge> : null}
        </button>
        <div className="space-y-1.5">
          {summaries.map((summary) => {
            const meta = CATEGORY_META[summary.category];
            const Icon = meta.Icon;
            const active = state.categoryFocus === summary.category;
            const peakMeta = summary.peakPriority ? PRIORITY_META[summary.peakPriority] : undefined;
            return (
              <button
                key={summary.category}
                type="button"
                aria-pressed={active}
                onClick={() => setFocus(summary.category)}
                className={cn(
                  "relative flex min-h-12 w-full items-center gap-3 rounded-lg border px-3 text-left text-sm transition-all",
                  active ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-transparent hover:border-border/70 hover:bg-secondary/70"
                )}
              >
                <span className="absolute inset-y-2 left-0 w-1 rounded-r-full" style={{ background: `var(${meta.colorVar})` }} />
                <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", active ? "bg-primary-foreground/14" : "bg-background/80")}>
                  <Icon className="size-4" style={{ color: active ? "currentColor" : `var(${meta.colorVar})` }} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate font-medium">{meta.label}</span>
                    {peakMeta ? (
                      <span
                        className="size-2 rounded-full"
                        style={{ background: active ? "currentColor" : `var(${peakMeta.colorVar})` }}
                        aria-label={`${peakMeta.label} priority`}
                      />
                    ) : null}
                  </span>
                  <span className={cn("mt-0.5 block font-mono text-[11px]", active ? "text-primary-foreground/78" : "text-muted-foreground")}>
                    {summary.activeTicketCount} tickets · {summary.activeMemoCount} memos
                  </span>
                </span>
                {summary.urgentCount > 0 || summary.highCount > 0 ? (
                  <span className={cn("rounded-full px-1.5 py-0.5 font-mono text-[10px]", active ? "bg-primary-foreground/16" : "bg-background/80")}>
                    {summary.urgentCount > 0 ? `${summary.urgentCount}u` : `${summary.highCount}h`}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </section>
      <CategorySummarySheet
        category={sheetCategory}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        sidebarWidth={sidebarWidth}
      />
    </>
  );
}

export function CategoryOperationsDock() {
  const { state, dispatch } = useGuestCrm();
  const [open, setOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryCategory, setSummaryCategory] = useState<TicketCategory | undefined>();
  const summaries = selectCategoryOperations(state);
  const totals = useCategoryTotals(summaries);
  const selectedSummary = state.categoryFocus === "all" ? undefined : summaries.find((summary) => summary.category === state.categoryFocus);
  const selectedLabel = state.categoryFocus === "all" ? "All operations" : CATEGORY_META[state.categoryFocus].label;

  function setFocus(category: CategoryFocus) {
    dispatch({ type: "SET_CATEGORY_FOCUS", payload: { category } });
    setOpen(false);
    if (category === "all") {
      setSummaryOpen(false);
      return;
    }
    setSummaryCategory(category);
    setSummaryOpen(true);
  }

  return (
    <div className="min-w-0 flex-1 md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            className="flex min-h-11 w-full items-center gap-3 rounded-full border bg-background/78 px-3 text-left shadow-sm"
            aria-label="Open category operations"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <LayoutGrid className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{selectedLabel}</span>
              <span className="block font-mono text-[11px] text-muted-foreground">
                {selectedSummary
                  ? `${selectedSummary.activeTicketCount} tickets · ${selectedSummary.activeMemoCount} memos`
                  : `${totals.tickets} tickets · ${totals.memos} memos`}
              </span>
            </span>
            {totals.urgent > 0 ? <Badge variant="champagne">{totals.urgent}u</Badge> : null}
            <ChevronDown className="size-4 text-muted-foreground" />
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="max-h-[82dvh] overflow-y-auto rounded-t-xl p-4 pb-[max(var(--safe-bottom),1rem)]">
          <SheetHeader className="mb-4 text-left">
            <SheetTitle>Operations</SheetTitle>
            <SheetDescription>Filter tickets and voice memos by operational category.</SheetDescription>
          </SheetHeader>
          <div className="grid gap-2">
            <MobileOperationRow
              label="All operations"
              active={state.categoryFocus === "all"}
              tickets={totals.tickets}
              memos={totals.memos}
              urgent={totals.urgent}
              onClick={() => setFocus("all")}
            />
            {summaries.map((summary) => {
              const meta = CATEGORY_META[summary.category];
              const Icon = meta.Icon;
              return (
                <MobileOperationRow
                  key={summary.category}
                  label={meta.label}
                  active={state.categoryFocus === summary.category}
                  tickets={summary.activeTicketCount}
                  memos={summary.activeMemoCount}
                  urgent={summary.urgentCount}
                  high={summary.highCount}
                  accent={meta.colorVar}
                  onClick={() => setFocus(summary.category)}
                  icon={<Icon className="size-4" />}
                />
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
      <CategorySummarySheet
        category={summaryCategory}
        open={summaryOpen}
        onOpenChange={setSummaryOpen}
        sidebarWidth="0px"
      />
    </div>
  );
}

function useCategoryTotals(summaries: ReturnType<typeof selectCategoryOperations>) {
  return useMemo(
    () =>
      summaries.reduce(
        (acc, summary) => ({
          tickets: acc.tickets + summary.activeTicketCount,
          memos: acc.memos + summary.activeMemoCount,
          urgent: acc.urgent + summary.urgentCount
        }),
        { tickets: 0, memos: 0, urgent: 0 }
      ),
    [summaries]
  );
}

function CollapsedOperationButton({
  label,
  active,
  urgentCount = 0,
  highCount = 0,
  accent,
  onClick,
  children
}: {
  label: string;
  active?: boolean;
  urgentCount?: number;
  highCount?: number;
  accent?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-pressed={active}
          onClick={onClick}
          className={cn(
            "relative flex min-h-11 w-full items-center justify-center rounded-xl border transition-colors",
            active ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-border/60 bg-background/58 text-muted-foreground hover:bg-secondary hover:text-foreground"
          )}
        >
          <span style={{ color: active ? "currentColor" : accent ? `var(${accent})` : undefined }}>{children}</span>
          {urgentCount > 0 || highCount > 0 ? (
            <span className="absolute -right-1 -top-1 rounded-full bg-destructive px-1.5 py-0.5 font-mono text-[9px] leading-none text-destructive-foreground">
              {urgentCount > 0 ? urgentCount : highCount}
            </span>
          ) : null}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

function MobileOperationRow({
  label,
  active,
  tickets,
  memos,
  urgent = 0,
  high = 0,
  accent,
  icon,
  onClick
}: {
  label: string;
  active?: boolean;
  tickets: number;
  memos: number;
  urgent?: number;
  high?: number;
  accent?: string;
  icon?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex min-h-14 items-center gap-3 rounded-xl border px-3 text-left transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "bg-background/78 hover:bg-secondary/70"
      )}
    >
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", active ? "bg-primary-foreground/14" : "bg-secondary")}>
        <span style={{ color: active ? "currentColor" : accent ? `var(${accent})` : undefined }}>{icon ?? <LayoutGrid className="size-4" />}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{label}</span>
        <span className={cn("font-mono text-[11px]", active ? "text-primary-foreground/78" : "text-muted-foreground")}>
          {tickets} tickets · {memos} memos
        </span>
      </span>
      {urgent > 0 || high > 0 ? <Badge variant={active ? "secondary" : "champagne"}>{urgent > 0 ? `${urgent} urgent` : `${high} high`}</Badge> : null}
    </button>
  );
}
