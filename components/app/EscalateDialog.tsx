"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { getEscalationTarget, ROLE_LABELS } from "@/lib/categories";
import { useGuestCrm } from "@/lib/store/store-context";
import type { Ticket } from "@/lib/types";

export function EscalateDialog({
  ticket,
  open,
  onOpenChange
}: {
  ticket: Ticket;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { dispatch } = useGuestCrm();
  const [note, setNote] = useState("");
  const targetRole = useMemo(() => getEscalationTarget(ticket.assignedTo), [ticket.assignedTo]);

  function handleEscalate() {
    dispatch({ type: "ESCALATE_TICKET", payload: { ticketId: ticket.id, note: note.trim() || undefined } });
    toast.error("Ticket escalated", {
      description: `Sent to ${ROLE_LABELS[targetRole]}.`
    });
    setNote("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-destructive" />
            Escalate ticket
          </DialogTitle>
          <DialogDescription>
            This will move the ticket to {ROLE_LABELS[targetRole]}, raise priority by one step, and mark it escalated.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Optional note for the escalation trail"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleEscalate}>
            Escalate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
