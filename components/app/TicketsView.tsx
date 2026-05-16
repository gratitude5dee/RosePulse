"use client";

import { useMemo, useState } from "react";
import { Columns3, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GuestAvatar } from "@/components/app/GuestAvatar";
import { PriorityBadge } from "@/components/app/PriorityBadge";
import { StatusPill } from "@/components/app/StatusPill";
import { TicketRow } from "@/components/app/TicketRow";
import { CATEGORY_META, CATEGORY_ORDER, PRIORITY_META, PRIORITY_ORDER, ROLE_LABELS, STATUS_LABELS } from "@/lib/categories";
import { formatAge, guestDisplayName } from "@/lib/format";
import { selectGuestById, selectTicketBoard } from "@/lib/store/selectors";
import { useGuestCrm } from "@/lib/store/store-context";
import type { StaffRole, Ticket, TicketCategory, TicketPriority, TicketStatus } from "@/lib/types";

const statuses: Array<TicketStatus | "all"> = ["all", "open", "in_progress", "blocked", "escalated", "resolved"];
const assignees: Array<StaffRole | "all"> = [
  "all",
  "concierge",
  "front_desk",
  "housekeeping_lead",
  "fnb_captain",
  "spa_supervisor",
  "security_lead",
  "manager"
];

export function TicketsView() {
  const { state, dispatch } = useGuestCrm();
  const [category, setCategory] = useState<TicketCategory | "all">("all");
  const [priority, setPriority] = useState<TicketPriority | "all">("all");
  const [status, setStatus] = useState<TicketStatus | "all">("all");
  const [assignedTo, setAssignedTo] = useState<StaffRole | "all">("all");
  const [view, setView] = useState<"list" | "kanban">("list");
  const tickets = selectTicketBoard(state, { category, priority, status, assignedTo });

  const groupedByPriority = useMemo(() => {
    return PRIORITY_ORDER.toReversed().map((item) => ({
      priority: item,
      tickets: tickets.filter((ticket) => ticket.priority === item)
    }));
  }, [tickets]);

  function openTicket(ticket: Ticket) {
    dispatch({ type: "OPEN_GUEST_DETAIL", payload: { guestId: ticket.guestId, ticketId: ticket.id } });
  }

  return (
    <div className="px-safe py-6 md:px-8">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="display-1">Tickets</h1>
          <p className="text-sm text-muted-foreground">Global board by priority, status, and ownership.</p>
        </div>
        <div className="flex gap-2">
          <Button variant={view === "list" ? "default" : "outline"} size="sm" onClick={() => setView("list")}>
            <List className="size-4" />
            List
          </Button>
          <Button variant={view === "kanban" ? "default" : "outline"} size="sm" onClick={() => setView("kanban")}>
            <Columns3 className="size-4" />
            Kanban
          </Button>
        </div>
      </div>

      <div className="mb-5 grid gap-3 rounded-lg border bg-background/62 p-3 lg:grid-cols-[1fr_180px_180px_220px]">
        <div className="flex min-w-0 gap-2 overflow-x-auto pb-1">
          <Button className="shrink-0" size="sm" variant={category === "all" ? "default" : "outline"} onClick={() => setCategory("all")}>
            All
          </Button>
          {CATEGORY_ORDER.map((item) => (
            <Button key={item} className="shrink-0" size="sm" variant={category === item ? "default" : "outline"} onClick={() => setCategory(item)}>
              {CATEGORY_META[item].label}
            </Button>
          ))}
        </div>
        <Select value={priority} onValueChange={(value) => setPriority(value as TicketPriority | "all")}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {PRIORITY_ORDER.map((item) => (
              <SelectItem key={item} value={item}>
                {PRIORITY_META[item].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(value) => setStatus(value as TicketStatus | "all")}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statuses.map((item) => (
              <SelectItem key={item} value={item}>
                {item === "all" ? "All statuses" : STATUS_LABELS[item]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={assignedTo} onValueChange={(value) => setAssignedTo(value as StaffRole | "all")}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {assignees.map((item) => (
              <SelectItem key={item} value={item}>
                {item === "all" ? "All assignees" : ROLE_LABELS[item]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {view === "list" ? (
        <div className="space-y-6">
          {groupedByPriority.map(({ priority: groupPriority, tickets: groupTickets }) =>
            groupTickets.length > 0 ? (
              <section key={groupPriority} className="rounded-lg border bg-background/72 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <PriorityBadge priority={groupPriority} />
                  <span className="font-mono text-xs text-muted-foreground">{groupTickets.length}</span>
                </div>
                <div className="space-y-1">
                  {groupTickets.map((ticket) => {
                    const guest = selectGuestById(state, ticket.guestId);
                    return (
                      <div key={ticket.id} className="grid min-w-0 gap-3 rounded-md border bg-background/60 p-2 lg:grid-cols-[220px_minmax(0,1fr)]">
                        {guest ? (
                          <div className="flex min-w-0 items-center gap-3 px-2">
                            <GuestAvatar guest={guest} className="size-9" />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{guestDisplayName(guest)}</p>
                              <p className="text-xs text-muted-foreground">{guest.roomNumber ?? guest.roomType}</p>
                            </div>
                          </div>
                        ) : null}
                        <TicketRow ticket={ticket} onOpen={openTicket} />
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null
          )}
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-5">
          {(["open", "in_progress", "blocked", "escalated", "resolved"] as TicketStatus[]).map((lane) => (
            <section key={lane} className="min-h-80 rounded-lg border bg-background/72 p-3">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">{STATUS_LABELS[lane]}</h2>
                <StatusPill status={lane} />
              </div>
              <div className="space-y-2">
                {tickets
                  .filter((ticket) => ticket.status === lane)
                  .map((ticket) => {
                    const guest = selectGuestById(state, ticket.guestId);
                    return (
                      <button
                        type="button"
                        key={ticket.id}
                        onClick={() => openTicket(ticket)}
                        className="min-h-11 w-full rounded-md border bg-secondary/30 p-3 text-left text-sm hover:bg-secondary/60"
                      >
                        <p className="font-medium">{ticket.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {guest ? guestDisplayName(guest) : "Guest"} · {CATEGORY_META[ticket.category].label} · {formatAge(ticket.updatedAt)}
                        </p>
                      </button>
                    );
                  })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
