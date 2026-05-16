"use client";

import { useState } from "react";
import { Copy, MoreHorizontal, Send, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { EscalateDialog } from "@/components/app/EscalateDialog";
import { PriorityBadge } from "@/components/app/PriorityBadge";
import { StatusPill } from "@/components/app/StatusPill";
import { CATEGORY_META, ROLE_LABELS } from "@/lib/categories";
import { formatAge } from "@/lib/format";
import { useGuestCrm } from "@/lib/store/store-context";
import type { Ticket } from "@/lib/types";
import { cn } from "@/lib/utils";

export function TicketRow({
  ticket,
  onOpen,
  compact = false,
  className
}: {
  ticket: Ticket;
  onOpen?: (ticket: Ticket) => void;
  compact?: boolean;
  className?: string;
}) {
  const { dispatch } = useGuestCrm();
  const [escalateOpen, setEscalateOpen] = useState(false);
  const category = CATEGORY_META[ticket.category];
  const assignee = ticket.assignedTo ? ROLE_LABELS[ticket.assignedTo] : "Unassigned";

  function markResolved() {
    dispatch({ type: "UPDATE_TICKET_STATUS", payload: { ticketId: ticket.id, status: "resolved" } });
    toast.success("Ticket resolved", { description: ticket.title });
  }

  function assignToLead() {
    dispatch({ type: "ASSIGN_TICKET", payload: { ticketId: ticket.id, assignedTo: category.leadRole } });
    toast.success("Ticket assigned", { description: `${category.label} lead now owns this.` });
  }

  async function copyLink() {
    const href = `${window.location.origin}/guests/${ticket.guestId}#${ticket.id}`;
    await navigator.clipboard?.writeText(href);
    toast.success("Ticket link copied");
  }

  return (
    <>
      <div
        id={ticket.id}
        data-tier="row"
        role="button"
        tabIndex={0}
        onClick={() => onOpen?.(ticket)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpen?.(ticket);
          }
        }}
        className={cn(
          "grid min-h-11 cursor-pointer grid-cols-[8px_minmax(0,1fr)_auto] items-center gap-3 rounded-md pr-2 text-left",
          ticket.status === "escalated" && "border-l-2 border-destructive bg-destructive/5",
          className
        )}
      >
        <span className="h-full rounded-l-md" style={{ background: `var(--prio-${ticket.priority === "medium" ? "med" : ticket.priority})` }} />
        <div className="min-w-0 py-2">
          <div className="truncate text-sm font-medium">{ticket.title}</div>
          <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span>{formatAge(ticket.updatedAt)}</span>
            <span aria-hidden>·</span>
            <span>{category.label}</span>
            {!compact ? (
              <>
                <span aria-hidden>·</span>
                <span className="truncate">{assignee}</span>
              </>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {compact ? null : <PriorityBadge priority={ticket.priority} className="hidden sm:inline-flex" />}
          <StatusPill status={ticket.status} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Actions for ${ticket.title}`}
                onClick={(event) => event.stopPropagation()}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(event) => {
                  event.stopPropagation();
                  setEscalateOpen(true);
                }}
              >
                <Send className="size-4" />
                Escalate
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(event) => {
                  event.stopPropagation();
                  markResolved();
                }}
              >
                Mark resolved
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(event) => {
                  event.stopPropagation();
                  assignToLead();
                }}
              >
                <UserCheck className="size-4" />
                Assign lead
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(event) => {
                  event.stopPropagation();
                  void copyLink();
                }}
              >
                <Copy className="size-4" />
                Copy link
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <EscalateDialog ticket={ticket} open={escalateOpen} onOpenChange={setEscalateOpen} />
    </>
  );
}
