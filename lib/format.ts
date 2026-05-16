import {
  addDays,
  differenceInCalendarDays,
  differenceInHours,
  differenceInMinutes,
  format,
  isSameDay,
  parseISO,
  startOfToday
} from "date-fns";
import type { Guest, GuestStatus, LoyaltyTier, StaffRole, TicketPriority, TicketStatus } from "@/lib/types";
import { ROLE_LABELS, STATUS_LABELS } from "@/lib/categories";

export function businessToday() {
  return startOfToday();
}

export function isoDateFromToday(offsetDays: number) {
  return format(addDays(businessToday(), offsetDays), "yyyy-MM-dd");
}

export function isoDateTimeFromNow(offsetHours: number) {
  const date = new Date();
  date.setHours(date.getHours() + offsetHours);
  return date.toISOString();
}

export function formatLongDate(date: Date | string) {
  return format(typeof date === "string" ? parseISO(date) : date, "EEEE, MMMM d");
}

export function formatShortDate(date: Date | string) {
  return format(typeof date === "string" ? parseISO(date) : date, "MMM d");
}

export function formatTime(date: Date | string) {
  return format(typeof date === "string" ? parseISO(date) : date, "h:mm a");
}

export function isTodayIso(date: string) {
  return isSameDay(parseISO(date), businessToday());
}

export function daysUntil(date: string) {
  return differenceInCalendarDays(parseISO(date), businessToday());
}

export function formatAge(iso: string) {
  const date = parseISO(iso);
  const now = new Date();
  const minutes = Math.max(0, differenceInMinutes(now, date));
  if (minutes < 60) return `${Math.max(1, minutes)}m`;
  const hours = differenceInHours(now, date);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function guestDisplayName(guest: Guest) {
  return guest.preferredName ? `${guest.preferredName} ${guest.lastName}` : `${guest.firstName} ${guest.lastName}`;
}

export function initials(guest: Pick<Guest, "firstName" | "lastName" | "preferredName">) {
  return `${guest.preferredName?.[0] ?? guest.firstName[0] ?? ""}${guest.lastName[0] ?? ""}`.toUpperCase();
}

export function nightCount(guest: Pick<Guest, "arrivalDate" | "departureDate">) {
  return Math.max(1, differenceInCalendarDays(parseISO(guest.departureDate), parseISO(guest.arrivalDate)));
}

export function staySummary(guest: Guest) {
  const nights = nightCount(guest);
  const occasion = guest.occasion ? titleCase(guest.occasion) : "Stay";
  const eta = guest.status === "arriving_today" ? "ETA 3:40 PM" : guest.roomNumber ? `Room ${guest.roomNumber}` : "Arrival pending";
  return `${guest.roomType}${guest.roomNumber ? ` ${guest.roomNumber}` : ""} · ${occasion} · ${nights} nights · ${eta}`;
}

export function titleCase(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatGuestStatus(status: GuestStatus) {
  return titleCase(status);
}

export function formatPriority(priority: TicketPriority) {
  return titleCase(priority);
}

export function formatStatus(status: TicketStatus) {
  return STATUS_LABELS[status];
}

export function formatRole(role: StaffRole) {
  return ROLE_LABELS[role];
}

export function formatLoyalty(tier: LoyaltyTier) {
  return tier;
}

export function clampText(value: string, length = 72) {
  if (value.length <= length) return value;
  return `${value.slice(0, length - 1).trim()}...`;
}

export function transcriptTitle(transcript: string) {
  const clean = transcript.trim().replace(/\s+/g, " ");
  if (!clean) return "Voice note follow-up";
  const firstSentence = clean.split(/[.!?]/)[0] ?? clean;
  return clampText(firstSentence, 56);
}
