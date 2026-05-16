import {
  AlertTriangle,
  BedDouble,
  CheckCircle2,
  Circle,
  Clock3,
  Flower2,
  ShieldCheck,
  Sparkles,
  Utensils,
  Wind,
  type LucideIcon
} from "lucide-react";
import type { StaffRole, TicketCategory, TicketPriority, TicketStatus } from "@/lib/types";

export interface CategoryMeta {
  key: TicketCategory;
  label: string;
  Icon: LucideIcon;
  colorVar: string;
  leadRole: StaffRole;
}

export const CATEGORY_ORDER = [
  "guest_relations",
  "room",
  "housekeeping",
  "security",
  "fnb",
  "spa"
] as const satisfies readonly TicketCategory[];

export const CATEGORY_META: Record<TicketCategory, CategoryMeta> = {
  guest_relations: {
    key: "guest_relations",
    label: "Guest Relations",
    Icon: Sparkles,
    colorVar: "--cat-guest-relations",
    leadRole: "concierge"
  },
  room: {
    key: "room",
    label: "Room",
    Icon: BedDouble,
    colorVar: "--cat-room",
    leadRole: "front_desk"
  },
  housekeeping: {
    key: "housekeeping",
    label: "Housekeeping",
    Icon: Wind,
    colorVar: "--cat-housekeeping",
    leadRole: "housekeeping_lead"
  },
  security: {
    key: "security",
    label: "Security",
    Icon: ShieldCheck,
    colorVar: "--cat-security",
    leadRole: "security_lead"
  },
  fnb: {
    key: "fnb",
    label: "F+B",
    Icon: Utensils,
    colorVar: "--cat-fnb",
    leadRole: "fnb_captain"
  },
  spa: {
    key: "spa",
    label: "Spa",
    Icon: Flower2,
    colorVar: "--cat-spa",
    leadRole: "spa_supervisor"
  }
};

export interface PriorityMeta {
  key: TicketPriority;
  label: string;
  colorVar: string;
  sortWeight: number;
}

export const PRIORITY_ORDER = ["low", "medium", "high", "urgent"] as const satisfies readonly TicketPriority[];

export const PRIORITY_META: Record<TicketPriority, PriorityMeta> = {
  low: { key: "low", label: "Low", colorVar: "--prio-low", sortWeight: 1 },
  medium: { key: "medium", label: "Medium", colorVar: "--prio-med", sortWeight: 2 },
  high: { key: "high", label: "High", colorVar: "--prio-high", sortWeight: 3 },
  urgent: { key: "urgent", label: "Urgent", colorVar: "--prio-urgent", sortWeight: 4 }
};

export const STATUS_LABELS: Record<TicketStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  blocked: "Blocked",
  resolved: "Resolved",
  escalated: "Escalated"
};

export const STATUS_ICONS: Record<TicketStatus, LucideIcon> = {
  open: Circle,
  in_progress: Clock3,
  blocked: AlertTriangle,
  resolved: CheckCircle2,
  escalated: AlertTriangle
};

export const ROLE_LABELS: Record<StaffRole, string> = {
  concierge: "Concierge",
  front_desk: "Front Desk",
  housekeeping_lead: "Housekeeping Lead",
  fnb_captain: "F+B Captain",
  spa_supervisor: "Spa Supervisor",
  security_lead: "Security Lead",
  manager: "Manager"
};

export function getEscalationTarget(role?: StaffRole): StaffRole {
  if (role === "concierge") return "front_desk";
  if (role === "front_desk") return "manager";
  return "manager";
}

export function bumpPriority(priority: TicketPriority): TicketPriority {
  const index = PRIORITY_ORDER.indexOf(priority);
  return PRIORITY_ORDER[Math.min(index + 1, PRIORITY_ORDER.length - 1)] ?? "urgent";
}
