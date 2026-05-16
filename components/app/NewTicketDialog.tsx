"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORY_META, CATEGORY_ORDER, PRIORITY_META, PRIORITY_ORDER, ROLE_LABELS } from "@/lib/categories";
import { guestDisplayName } from "@/lib/format";
import { useGuestCrm } from "@/lib/store/store-context";
import type { StaffRole } from "@/lib/types";

const newTicketSchema = z.object({
  guestId: z.string().min(1, "Choose a guest"),
  category: z.enum(CATEGORY_ORDER),
  priority: z.enum(PRIORITY_ORDER),
  title: z.string().min(4, "Add a short title").max(80, "Keep the title brief"),
  detail: z.string().min(8, "Add enough detail for the next staff member"),
  assignedTo: z.string().optional(),
  dueAt: z.string().optional()
});

type NewTicketValues = z.infer<typeof newTicketSchema>;

const ASSIGNEES: StaffRole[] = [
  "concierge",
  "front_desk",
  "housekeeping_lead",
  "fnb_captain",
  "spa_supervisor",
  "security_lead",
  "manager"
];

export function NewTicketDialog() {
  const { state, dispatch } = useGuestCrm();
  const form = useForm<NewTicketValues>({
    resolver: zodResolver(newTicketSchema),
    defaultValues: {
      guestId: state.newTicketDraft?.guestId ?? "",
      category: state.newTicketDraft?.category ?? "guest_relations",
      priority: "medium",
      title: "",
      detail: "",
      assignedTo: "",
      dueAt: ""
    }
  });

  useEffect(() => {
    if (state.newTicketOpen) {
      form.reset({
        guestId: state.newTicketDraft?.guestId ?? "",
        category: state.newTicketDraft?.category ?? "guest_relations",
        priority: "medium",
        title: "",
        detail: "",
        assignedTo: "",
        dueAt: ""
      });
    }
  }, [form, state.newTicketDraft, state.newTicketOpen]);

  function onSubmit(values: NewTicketValues) {
    dispatch({
      type: "CREATE_TICKET",
      payload: {
        guestId: values.guestId,
        category: values.category,
        priority: values.priority,
        title: values.title,
        detail: values.detail,
        assignedTo: values.assignedTo ? (values.assignedTo as StaffRole) : undefined,
        dueAt: values.dueAt ? new Date(values.dueAt).toISOString() : undefined
      }
    });
    toast.success("Ticket created", { description: values.title });
  }

  return (
    <Dialog open={state.newTicketOpen} onOpenChange={(open) => dispatch({ type: open ? "OPEN_NEW_TICKET" : "CLOSE_NEW_TICKET" })}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New ticket</DialogTitle>
          <DialogDescription>File a guest request so every team sees the same operational truth.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="guest">Guest</Label>
            <Controller
              control={form.control}
              name="guestId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="guest">
                    <SelectValue placeholder="Choose guest" />
                  </SelectTrigger>
                  <SelectContent>
                    {state.guests.map((guest) => (
                      <SelectItem key={guest.id} value={guest.id}>
                        {guestDisplayName(guest)} {guest.roomNumber ? `- ${guest.roomNumber}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {form.formState.errors.guestId ? <p className="text-xs text-destructive">{form.formState.errors.guestId.message}</p> : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label>Category</Label>
              <Controller
                control={form.control}
                name="category"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_ORDER.map((category) => (
                        <SelectItem key={category} value={category}>
                          {CATEGORY_META[category].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="grid gap-2">
              <Label>Priority</Label>
              <Controller
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <div className="grid grid-cols-4 rounded-md border bg-background/72 p-1">
                    {PRIORITY_ORDER.map((priority) => (
                      <button
                        key={priority}
                        type="button"
                        onClick={() => field.onChange(priority)}
                        className={`rounded px-2 py-1.5 text-xs font-medium ${field.value === priority ? "bg-secondary text-foreground" : "text-muted-foreground"}`}
                        style={field.value === priority ? { color: `var(${PRIORITY_META[priority].colorVar})` } : undefined}
                      >
                        {PRIORITY_META[priority].label}
                      </button>
                    ))}
                  </div>
                )}
              />
            </div>
            <div className="grid gap-2">
              <Label>Due</Label>
              <Input type="datetime-local" {...form.register("dueAt")} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" {...form.register("title")} placeholder="Replace pillows - feather allergy" />
            {form.formState.errors.title ? <p className="text-xs text-destructive">{form.formState.errors.title.message}</p> : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="detail">Detail</Label>
            <Textarea id="detail" {...form.register("detail")} placeholder="Add the operational note in one to three sentences." />
            {form.formState.errors.detail ? <p className="text-xs text-destructive">{form.formState.errors.detail.message}</p> : null}
          </div>

          <div className="grid gap-2">
            <Label>Assignee</Label>
            <Controller
              control={form.control}
              name="assignedTo"
              render={({ field }) => (
                <Select value={field.value || "auto"} onValueChange={(value) => field.onChange(value === "auto" ? "" : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Auto assign" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto assign category lead</SelectItem>
                    {ASSIGNEES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => dispatch({ type: "CLOSE_NEW_TICKET" })}>
              Cancel
            </Button>
            <Button type="submit">Create ticket</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
