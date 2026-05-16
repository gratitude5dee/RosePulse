"use client";

import { useMemo } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { TicketRow } from "@/components/app/TicketRow";
import { CATEGORY_META, CATEGORY_ORDER, PRIORITY_META } from "@/lib/categories";
import { isActiveTicket, sortTickets } from "@/lib/store/selectors";
import type { Ticket, TicketCategory } from "@/lib/types";

export function TicketAccordion({
  tickets,
  onOpenTicket,
  activeCategories,
  onCategoriesChange,
  maxVisible
}: {
  tickets: Ticket[];
  onOpenTicket?: (ticket: Ticket) => void;
  activeCategories?: TicketCategory[];
  onCategoriesChange?: (categories: TicketCategory[]) => void;
  maxVisible?: number;
}) {
  const grouped = useMemo(
    () =>
      CATEGORY_ORDER.map((category) => ({
        category,
        tickets: tickets.filter((ticket) => ticket.category === category && isActiveTicket(ticket)).toSorted(sortTickets)
      })),
    [tickets]
  );

  return (
    <Accordion
      type="multiple"
      value={activeCategories}
      onValueChange={(value) => onCategoriesChange?.(value as TicketCategory[])}
      className="w-full"
    >
      {grouped.map(({ category, tickets: categoryTickets }) => {
        const meta = CATEGORY_META[category];
        const Icon = meta.Icon;
        const highest = categoryTickets[0]?.priority;
        return (
          <AccordionItem key={category} value={category} id={`accordion-${category}`} className="last:border-b-0">
            <AccordionTrigger disabled={categoryTickets.length === 0} className="py-2">
              <span className="flex min-w-0 items-center gap-2">
                <Icon className="size-4" style={{ color: `var(${meta.colorVar})` }} />
                <span>{meta.label}</span>
                <span className="rounded-full bg-secondary px-1.5 font-mono text-[11px]">{categoryTickets.length}</span>
              </span>
              {highest ? (
                <span
                  className="mr-2 rounded-full px-2 py-0.5 text-[11px] font-medium"
                  style={{ color: `var(${PRIORITY_META[highest].colorVar})` }}
                >
                  {PRIORITY_META[highest].label}
                </span>
              ) : null}
            </AccordionTrigger>
            <AccordionContent className="space-y-1">
              {(maxVisible ? categoryTickets.slice(0, maxVisible) : categoryTickets).map((ticket) => (
                <TicketRow key={ticket.id} ticket={ticket} onOpen={onOpenTicket} compact />
              ))}
              {maxVisible && categoryTickets.length > maxVisible ? (
                <button
                  type="button"
                  className="px-3 py-1 text-xs font-medium text-primary hover:underline"
                  onClick={() => onOpenTicket?.(categoryTickets[maxVisible])}
                >
                  + {categoryTickets.length - maxVisible} more
                </button>
              ) : null}
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
