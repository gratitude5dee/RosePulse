"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Plus, Radio, Route, Ticket, UserRound } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from "@/components/ui/command";
import { formatStatus, guestDisplayName } from "@/lib/format";
import { useGuestCrm } from "@/lib/store/store-context";

const routes = [
  { href: "/today", label: "Today", Icon: CalendarDays },
  { href: "/arriving", label: "Arriving", Icon: CalendarDays },
  { href: "/guests", label: "Guests", Icon: UserRound },
  { href: "/tickets", label: "Tickets", Icon: Ticket },
  { href: "/radio", label: "Radio", Icon: Radio }
];

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const { state, dispatch } = useGuestCrm();

  const guests = useMemo(() => state.guests.slice(0, 30), [state.guests]);
  const tickets = useMemo(() => state.tickets.slice(0, 40), [state.tickets]);

  function close() {
    onOpenChange(false);
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search guests, rooms, tickets, routes..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Routes">
          {routes.map(({ href, label, Icon }) => (
            <CommandItem
              key={href}
              value={`${label} ${href}`}
              onSelect={() => {
                router.push(href);
                close();
              }}
            >
              <Icon className="size-4 text-muted-foreground" />
              {label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Quick actions">
          <CommandItem
            value="New ticket create request"
            onSelect={() => {
              dispatch({ type: "OPEN_NEW_TICKET" });
              close();
            }}
          >
            <Plus className="size-4 text-muted-foreground" />
            New ticket
          </CommandItem>
          <CommandItem
            value="Open radio walkie talkie"
            onSelect={() => {
              router.push("/radio");
              close();
            }}
          >
            <Radio className="size-4 text-muted-foreground" />
            Open radio
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Guests">
          {guests.map((guest) => (
            <CommandItem
              key={guest.id}
              value={`${guestDisplayName(guest)} ${guest.roomNumber ?? ""} ${guest.tags.join(" ")}`}
              onSelect={() => {
                dispatch({ type: "OPEN_GUEST_DETAIL", payload: { guestId: guest.id } });
                close();
              }}
            >
              <UserRound className="size-4 text-muted-foreground" />
              <span>{guestDisplayName(guest)}</span>
              <span className="ml-auto text-xs text-muted-foreground">{guest.roomNumber ?? guest.status}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Tickets">
          {tickets.map((ticket) => (
            <CommandItem
              key={ticket.id}
              value={`${ticket.id} ${ticket.title} ${ticket.status}`}
              onSelect={() => {
                dispatch({ type: "OPEN_GUEST_DETAIL", payload: { guestId: ticket.guestId, ticketId: ticket.id } });
                close();
              }}
            >
              <Ticket className="size-4 text-muted-foreground" />
              <span className="truncate">{ticket.title}</span>
              <span className="ml-auto text-xs text-muted-foreground">{formatStatus(ticket.status)}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="System">
          <CommandItem value="Route stub settings">
            <Route className="size-4 text-muted-foreground" />
            Settings
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
