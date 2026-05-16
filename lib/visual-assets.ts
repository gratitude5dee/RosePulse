import type { Guest, Ticket, TicketCategory, TicketPriority } from "@/lib/types";

export type VisualAssetKey =
  | "propertyArrival"
  | "guestSuite"
  | "maderaDining"
  | "asayaSpa"
  | "poolRetreat"
  | "serviceCorridor"
  | "residentialVilla";

export interface VisualAsset {
  key: VisualAssetKey;
  src: string;
  alt: string;
  width: number;
  height: number;
  tone: "arrival" | "room" | "dining" | "wellness" | "outdoor" | "service" | "residential";
}

export const VISUAL_ASSETS: Record<VisualAssetKey, VisualAsset> = {
  propertyArrival: {
    key: "propertyArrival",
    src: "/images/rosewood-sand-hill/property-arrival.webp",
    alt: "Editorial illustration of a warm Northern California hotel arrival garden at Rosewood Sand Hill.",
    width: 1400,
    height: 840,
    tone: "arrival"
  },
  guestSuite: {
    key: "guestSuite",
    src: "/images/rosewood-sand-hill/guest-suite.webp",
    alt: "Editorial illustration of a refined guest room with balcony views over foothill gardens.",
    width: 1400,
    height: 840,
    tone: "room"
  },
  maderaDining: {
    key: "maderaDining",
    src: "/images/rosewood-sand-hill/madera-dining.webp",
    alt: "Editorial illustration of an elegant dining room entry inspired by Madera at Sand Hill.",
    width: 1400,
    height: 840,
    tone: "dining"
  },
  asayaSpa: {
    key: "asayaSpa",
    src: "/images/rosewood-sand-hill/asaya-spa.webp",
    alt: "Editorial illustration of a quiet spa treatment room with warm wood and soft daylight.",
    width: 1400,
    height: 840,
    tone: "wellness"
  },
  poolRetreat: {
    key: "poolRetreat",
    src: "/images/rosewood-sand-hill/pool-retreat.webp",
    alt: "Editorial illustration of a serene pool retreat framed by gardens and distant foothills.",
    width: 1400,
    height: 840,
    tone: "outdoor"
  },
  serviceCorridor: {
    key: "serviceCorridor",
    src: "/images/rosewood-sand-hill/service-corridor.webp",
    alt: "Editorial illustration of a discreet luxury service corridor prepared for staff handoff.",
    width: 1400,
    height: 840,
    tone: "service"
  },
  residentialVilla: {
    key: "residentialVilla",
    src: "/images/rosewood-sand-hill/residential-villa.webp",
    alt: "Editorial illustration of a residential villa living space with indoor outdoor foothill views.",
    width: 1400,
    height: 840,
    tone: "residential"
  }
};

const CATEGORY_VISUALS: Record<TicketCategory, VisualAssetKey> = {
  guest_relations: "serviceCorridor",
  room: "guestSuite",
  housekeeping: "guestSuite",
  security: "serviceCorridor",
  fnb: "maderaDining",
  spa: "asayaSpa"
};

const PRIORITY_WEIGHT: Record<TicketPriority, number> = {
  low: 1,
  medium: 2,
  high: 3,
  urgent: 4
};

export function getCategoryVisualAsset(category: TicketCategory): VisualAsset {
  return VISUAL_ASSETS[CATEGORY_VISUALS[category]];
}

export function getGuestVisualAsset(guest: Guest, tickets: readonly Ticket[] = []): VisualAsset {
  const activeTicket = tickets
    .filter((ticket) => ticket.status !== "resolved")
    .toSorted((a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority] || b.updatedAt.localeCompare(a.updatedAt))[0];

  if (activeTicket) {
    return getCategoryVisualAsset(activeTicket.category);
  }

  const roomType = guest.roomType.toLowerCase();
  if (roomType.includes("villa") || roomType.includes("residence")) {
    return VISUAL_ASSETS.residentialVilla;
  }

  if (guest.loyaltyTier === "Founder" || guest.loyaltyTier === "Platinum") {
    return VISUAL_ASSETS.residentialVilla;
  }

  if (guest.occasion === "honeymoon" || guest.occasion === "leisure") {
    return VISUAL_ASSETS.poolRetreat;
  }

  if (roomType.includes("suite") || roomType.includes("room")) {
    return VISUAL_ASSETS.guestSuite;
  }

  return VISUAL_ASSETS.propertyArrival;
}
