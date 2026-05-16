import { CATEGORY_META, getEscalationTarget } from "@/lib/categories";
import { isoDateTimeFromNow } from "@/lib/format";
import type { StaffRole, Ticket, TicketCategory, TicketEvent, TicketPriority, TicketStatus } from "@/lib/types";

interface TicketInput {
  id: string;
  guestId: string;
  category: TicketCategory;
  title: string;
  detail: string;
  priority: TicketPriority;
  status: TicketStatus;
  ageHours: number;
  assignedTo?: StaffRole;
  dueInHours?: number;
  createdBy?: string;
}

const STAFF_NAMES: Record<string, string> = {
  s_001: "Amara Singh",
  s_002: "Julian Marquez",
  s_003: "Elena Rossi",
  s_004: "Marc Dupont",
  s_005: "Keiko Watanabe",
  s_006: "Nadia Brooks",
  s_007: "Theo Caldwell"
};

function makeTicket(input: TicketInput): Ticket {
  const createdAt = isoDateTimeFromNow(-input.ageHours);
  const updatedAt = isoDateTimeFromNow(-Math.max(1, Math.floor(input.ageHours / 3)));
  const createdBy = input.createdBy ?? "s_001";
  const assignedTo = input.assignedTo ?? CATEGORY_META[input.category].leadRole;
  const events: TicketEvent[] = [
    {
      id: `${input.id}_e_created`,
      ticketId: input.id,
      type: "created" as const,
      actorId: createdBy,
      actorName: STAFF_NAMES[createdBy] ?? "Rosewood Team",
      at: createdAt,
      body: input.detail
    }
  ];

  if (input.status === "resolved") {
    events.push({
      id: `${input.id}_e_resolved`,
      ticketId: input.id,
      type: "status_changed" as const,
      actorId: "s_007",
      actorName: "Theo Caldwell",
      at: updatedAt,
      fromStatus: "in_progress",
      toStatus: "resolved",
      body: "Resolved and confirmed with the guest."
    });
  }

  if (input.status === "escalated") {
    events.push({
      id: `${input.id}_e_escalated`,
      ticketId: input.id,
      type: "escalated" as const,
      actorId: "s_001",
      actorName: "Amara Singh",
      at: updatedAt,
      escalatedTo: getEscalationTarget(assignedTo),
      body: "Escalated for immediate leadership attention."
    });
  }

  return {
    id: input.id,
    guestId: input.guestId,
    category: input.category,
    title: input.title,
    detail: input.detail,
    priority: input.priority,
    status: input.status,
    createdAt,
    updatedAt,
    createdBy,
    assignedTo,
    dueAt: input.dueInHours === undefined ? undefined : isoDateTimeFromNow(input.dueInHours),
    events
  };
}

export const ticketFixtures: Ticket[] = [
  makeTicket({
    id: "t_8801",
    guestId: "g_0426",
    category: "security",
    title: "Coordinate discreet family arrival",
    detail: "Security lead flagged lobby press risk. Use side entrance and hold lift from 3:35 PM to 3:50 PM.",
    priority: "urgent",
    status: "escalated",
    ageHours: 2,
    assignedTo: "security_lead",
    dueInHours: 1
  }),
  makeTicket({
    id: "t_8802",
    guestId: "g_0507",
    category: "guest_relations",
    title: "Protect private birthday movement",
    detail: "Guest requested no lobby exposure before chef's table. Manager should confirm side-door plan with security.",
    priority: "urgent",
    status: "escalated",
    ageHours: 5,
    assignedTo: "concierge",
    dueInHours: 2
  }),
  makeTicket({
    id: "t_8803",
    guestId: "g_0421",
    category: "fnb",
    title: "Confirm shellfish-safe anniversary dinner",
    detail: "Guest has shellfish allergy. Chef needs final tasting menu sign-off before amenity card is printed.",
    priority: "urgent",
    status: "open",
    ageHours: 3,
    assignedTo: "fnb_captain",
    dueInHours: 3
  }),
  makeTicket({
    id: "t_8804",
    guestId: "g_0501",
    category: "room",
    title: "Repair terrace lock before evening turn",
    detail: "Penthouse terrace latch is sticking. Engineering has parts but needs guest-approved window.",
    priority: "urgent",
    status: "blocked",
    ageHours: 7,
    assignedTo: "front_desk",
    dueInHours: 4
  }),
  makeTicket({
    id: "t_8805",
    guestId: "g_0421",
    category: "guest_relations",
    title: "Place handwritten anniversary card",
    detail: "Use the ivory stationery and reference last year's Provence itinerary. Card should be in suite before arrival.",
    priority: "high",
    status: "in_progress",
    ageHours: 4,
    assignedTo: "concierge"
  }),
  makeTicket({
    id: "t_8806",
    guestId: "g_0421",
    category: "housekeeping",
    title: "Remove feather pillows",
    detail: "Replace all bed pillows with hypoallergenic pillows and confirm closet spares are also feather-free.",
    priority: "high",
    status: "open",
    ageHours: 6,
    assignedTo: "housekeeping_lead"
  }),
  makeTicket({
    id: "t_8807",
    guestId: "g_0421",
    category: "spa",
    title: "Hold couples hammam at 10 AM",
    detail: "Guest mentioned interest during pre-arrival call. Hold room until 6 PM pending confirmation.",
    priority: "medium",
    status: "open",
    ageHours: 9,
    assignedTo: "spa_supervisor"
  }),
  makeTicket({
    id: "t_8808",
    guestId: "g_0422",
    category: "room",
    title: "Stage espresso setup",
    detail: "Place compact espresso machine, still water, and no minibar spirits before 1:00 PM early check-in.",
    priority: "high",
    status: "in_progress",
    ageHours: 2,
    assignedTo: "front_desk"
  }),
  makeTicket({
    id: "t_8809",
    guestId: "g_0422",
    category: "fnb",
    title: "Hold quiet table for board dinner",
    detail: "Guest needs a discreet table for four after 8:45 PM. Avoid center dining room.",
    priority: "medium",
    status: "open",
    ageHours: 8,
    assignedTo: "fnb_captain"
  }),
  makeTicket({
    id: "t_8810",
    guestId: "g_0422",
    category: "guest_relations",
    title: "Confirm assistant contact protocol",
    detail: "Assistant confirmed no calls before 8:30 AM. Profile note updated and front desk briefed.",
    priority: "low",
    status: "resolved",
    ageHours: 18,
    assignedTo: "front_desk"
  }),
  makeTicket({
    id: "t_8811",
    guestId: "g_0423",
    category: "housekeeping",
    title: "Place crib and bottle warmer",
    detail: "Family arrives with infant. Crib, bottle warmer, and extra muslin blankets should be staged before arrival.",
    priority: "high",
    status: "open",
    ageHours: 1,
    assignedTo: "housekeeping_lead"
  }),
  makeTicket({
    id: "t_8812",
    guestId: "g_0423",
    category: "fnb",
    title: "Prepare birthday cake with no nuts",
    detail: "Small vanilla cake for room arrival. Avoid nuts and keep the inscription simple.",
    priority: "medium",
    status: "in_progress",
    ageHours: 4,
    assignedTo: "fnb_captain"
  }),
  makeTicket({
    id: "t_8813",
    guestId: "g_0423",
    category: "room",
    title: "Assign away from elevator bank",
    detail: "Infant sleep schedule. Room 221 is held; confirm no maintenance noise nearby.",
    priority: "medium",
    status: "open",
    ageHours: 6,
    assignedTo: "front_desk"
  }),
  makeTicket({
    id: "t_8814",
    guestId: "g_0424",
    category: "fnb",
    title: "Send halal outdoor dining shortlist",
    detail: "Concierge sent three refined outdoor options with halal notes and transport times.",
    priority: "medium",
    status: "resolved",
    ageHours: 22,
    assignedTo: "concierge"
  }),
  makeTicket({
    id: "t_8815",
    guestId: "g_0424",
    category: "spa",
    title: "Offer post-flight massage window",
    detail: "Guest asked about spa availability. Hold a 50-minute treatment at 6:15 PM if room is ready.",
    priority: "low",
    status: "open",
    ageHours: 10,
    assignedTo: "spa_supervisor"
  }),
  makeTicket({
    id: "t_8816",
    guestId: "g_0425",
    category: "housekeeping",
    title: "Press navy jacket before 7 AM",
    detail: "Guest arrives late and needs jacket ready for breakfast meeting. Collect garment during check-in.",
    priority: "high",
    status: "open",
    ageHours: 3,
    assignedTo: "housekeeping_lead"
  }),
  makeTicket({
    id: "t_8817",
    guestId: "g_0425",
    category: "room",
    title: "Place garment steamer",
    detail: "Add steamer and lint brush to wardrobe. Front desk should mention location during rooming.",
    priority: "medium",
    status: "open",
    ageHours: 4,
    assignedTo: "front_desk"
  }),
  makeTicket({
    id: "t_8818",
    guestId: "g_0426",
    category: "room",
    title: "Confirm connecting room readiness",
    detail: "Two connecting rooms must be inspected together. Kids' amenities should match suite tone.",
    priority: "high",
    status: "in_progress",
    ageHours: 2,
    assignedTo: "front_desk"
  }),
  makeTicket({
    id: "t_8819",
    guestId: "g_0426",
    category: "fnb",
    title: "Set private dining call",
    detail: "Family wants private dining options for night one. F+B captain to call after arrival window.",
    priority: "medium",
    status: "open",
    ageHours: 7,
    assignedTo: "fnb_captain"
  }),
  makeTicket({
    id: "t_8820",
    guestId: "g_0501",
    category: "fnb",
    title: "Confirm dairy-free terrace breakfast",
    detail: "Breakfast set without dairy was confirmed by room service and delivered on time.",
    priority: "medium",
    status: "resolved",
    ageHours: 28,
    assignedTo: "fnb_captain"
  }),
  makeTicket({
    id: "t_8821",
    guestId: "g_0501",
    category: "spa",
    title: "Prepare honeymoon bath ritual",
    detail: "Spa team to place salts and robe cards after engineering clears terrace window.",
    priority: "medium",
    status: "open",
    ageHours: 11,
    assignedTo: "spa_supervisor"
  }),
  makeTicket({
    id: "t_8822",
    guestId: "g_0502",
    category: "room",
    title: "Add printer paper and toner",
    detail: "Guest is preparing legal documents. Business center printer must be stocked before 5 PM.",
    priority: "high",
    status: "open",
    ageHours: 2,
    assignedTo: "front_desk"
  }),
  makeTicket({
    id: "t_8823",
    guestId: "g_0502",
    category: "fnb",
    title: "Verify kosher breakfast options",
    detail: "Room service needs packaged options listed clearly on breakfast tray card.",
    priority: "medium",
    status: "blocked",
    ageHours: 12,
    assignedTo: "fnb_captain"
  }),
  makeTicket({
    id: "t_8824",
    guestId: "g_0502",
    category: "housekeeping",
    title: "Swap to firm mattress topper",
    detail: "Guest reported mattress too soft. Housekeeping to add firm topper during dinner window.",
    priority: "medium",
    status: "in_progress",
    ageHours: 5,
    assignedTo: "housekeeping_lead"
  }),
  makeTicket({
    id: "t_8825",
    guestId: "g_0503",
    category: "fnb",
    title: "Vegetarian tasting menu review",
    detail: "Chef should review the tasting menu in person and avoid eggplant, per prior stay note.",
    priority: "high",
    status: "open",
    ageHours: 6,
    assignedTo: "fnb_captain"
  }),
  makeTicket({
    id: "t_8826",
    guestId: "g_0503",
    category: "housekeeping",
    title: "Place jasmine arrangement",
    detail: "Jasmine arrangement placed in suite entry, away from bedside table.",
    priority: "low",
    status: "resolved",
    ageHours: 16,
    assignedTo: "housekeeping_lead"
  }),
  makeTicket({
    id: "t_8827",
    guestId: "g_0503",
    category: "spa",
    title: "Send yoga mat and bolster",
    detail: "Guest requested a mat for sunrise practice. Add bolster and eucalyptus towel.",
    priority: "medium",
    status: "open",
    ageHours: 9,
    assignedTo: "spa_supervisor"
  }),
  makeTicket({
    id: "t_8828",
    guestId: "g_0504",
    category: "housekeeping",
    title: "Replenish towels after tennis",
    detail: "Guest asked for extra bath sheets and sparkling water after afternoon tennis.",
    priority: "low",
    status: "open",
    ageHours: 1,
    assignedTo: "housekeeping_lead"
  }),
  makeTicket({
    id: "t_8829",
    guestId: "g_0504",
    category: "guest_relations",
    title: "Suggest quiet dinner options",
    detail: "Concierge to send two quiet dinner venues and one hotel option with outdoor seating.",
    priority: "medium",
    status: "open",
    ageHours: 4,
    assignedTo: "concierge"
  }),
  makeTicket({
    id: "t_8830",
    guestId: "g_0505",
    category: "room",
    title: "Stage bags for 1:15 PM transfer",
    detail: "Departure transfer confirmed. Bell team should collect bags at noon and hold VAT envelope.",
    priority: "high",
    status: "in_progress",
    ageHours: 2,
    assignedTo: "front_desk"
  }),
  makeTicket({
    id: "t_8831",
    guestId: "g_0505",
    category: "guest_relations",
    title: "Prepare VAT invoice envelope",
    detail: "Invoice printed and placed with departure packet at front desk.",
    priority: "medium",
    status: "resolved",
    ageHours: 14,
    assignedTo: "front_desk"
  }),
  makeTicket({
    id: "t_8832",
    guestId: "g_0506",
    category: "housekeeping",
    title: "Rush laundry before 6 AM",
    detail: "Guest needs two shirts returned before early breakfast. Laundry team has collection bag.",
    priority: "high",
    status: "open",
    ageHours: 7,
    assignedTo: "housekeeping_lead"
  }),
  makeTicket({
    id: "t_8833",
    guestId: "g_0506",
    category: "fnb",
    title: "Schedule black coffee tray",
    detail: "Send coffee tray at 6:15 AM with no pastry unless requested.",
    priority: "low",
    status: "open",
    ageHours: 8,
    assignedTo: "fnb_captain"
  }),
  makeTicket({
    id: "t_8834",
    guestId: "g_0507",
    category: "fnb",
    title: "Confirm chef's table child menu",
    detail: "Chef needs a polished child menu and one dairy-free dessert option.",
    priority: "high",
    status: "in_progress",
    ageHours: 3,
    assignedTo: "fnb_captain"
  }),
  makeTicket({
    id: "t_8835",
    guestId: "g_0507",
    category: "housekeeping",
    title: "Deliver child robe in suite",
    detail: "Place robe and slippers without branded packaging. Guest prefers understated presentation.",
    priority: "low",
    status: "open",
    ageHours: 6,
    assignedTo: "housekeeping_lead"
  }),
  makeTicket({
    id: "t_8836",
    guestId: "g_0508",
    category: "guest_relations",
    title: "Book whiskey tasting hold",
    detail: "Concierge placed a provisional hold for 7:30 PM and notified the guest.",
    priority: "medium",
    status: "resolved",
    ageHours: 20,
    assignedTo: "concierge"
  }),
  makeTicket({
    id: "t_8837",
    guestId: "g_0508",
    category: "spa",
    title: "Offer recovery massage after golf",
    detail: "Guest asked about next-day availability. Hold a 4 PM recovery massage until noon.",
    priority: "low",
    status: "open",
    ageHours: 5,
    assignedTo: "spa_supervisor"
  }),
  makeTicket({
    id: "t_8838",
    guestId: "g_0601",
    category: "guest_relations",
    title: "Design restrained anniversary amenity",
    detail: "Use rose petals sparingly and avoid balloons. Manager wants the suite note reviewed.",
    priority: "medium",
    status: "open",
    ageHours: 30,
    assignedTo: "concierge"
  }),
  makeTicket({
    id: "t_8839",
    guestId: "g_0602",
    category: "room",
    title: "Hold standing desk kit",
    detail: "Guest requested a standing desk and green tea service. Confirm kit availability before arrival.",
    priority: "low",
    status: "open",
    ageHours: 24,
    assignedTo: "front_desk"
  }),
  makeTicket({
    id: "t_8840",
    guestId: "g_0603",
    category: "guest_relations",
    title: "Build arts itinerary",
    detail: "Concierge to prepare two museum options, one private gallery, and a relaxed lunch nearby.",
    priority: "medium",
    status: "open",
    ageHours: 36,
    assignedTo: "concierge"
  }),
  makeTicket({
    id: "t_8841",
    guestId: "g_0604",
    category: "security",
    title: "Schedule penthouse security sweep",
    detail: "Security sweep needed before suite release. Coordinate with housekeeping final pass.",
    priority: "high",
    status: "open",
    ageHours: 40,
    assignedTo: "security_lead"
  }),
  makeTicket({
    id: "t_8842",
    guestId: "g_0604",
    category: "fnb",
    title: "Hold private chef consult",
    detail: "Chef consult held with assistant and dietary boundaries recorded.",
    priority: "medium",
    status: "resolved",
    ageHours: 48,
    assignedTo: "fnb_captain"
  }),
  makeTicket({
    id: "t_8843",
    guestId: "g_0605",
    category: "room",
    title: "Confirm boardroom hold",
    detail: "Assistant requested a half-day boardroom hold. Front desk to verify billing code.",
    priority: "medium",
    status: "open",
    ageHours: 26,
    assignedTo: "front_desk"
  }),
  makeTicket({
    id: "t_8844",
    guestId: "g_0606",
    category: "spa",
    title: "Block family spa suite",
    detail: "Hold spa suite for birthday afternoon. White orchids only, no red roses.",
    priority: "high",
    status: "open",
    ageHours: 32,
    assignedTo: "spa_supervisor"
  }),
  makeTicket({
    id: "t_8845",
    guestId: "g_0606",
    category: "housekeeping",
    title: "Prepare connecting room amenities",
    detail: "Coordinate robes, slippers, and family cake delivery with suite release.",
    priority: "medium",
    status: "open",
    ageHours: 30,
    assignedTo: "housekeeping_lead"
  }),
  makeTicket({
    id: "t_8846",
    guestId: "g_0701",
    category: "security",
    title: "Log scarf handoff",
    detail: "Lost scarf is in the safe cabinet. Security should log courier pickup with tracking.",
    priority: "low",
    status: "open",
    ageHours: 12,
    assignedTo: "security_lead"
  }),
  makeTicket({
    id: "t_8847",
    guestId: "g_0702",
    category: "guest_relations",
    title: "Remove marketing preferences",
    detail: "Guest asked for no marketing contact. Keep future outreach through assistant only.",
    priority: "medium",
    status: "open",
    ageHours: 44,
    assignedTo: "manager"
  }),
  makeTicket({
    id: "t_8848",
    guestId: "g_0703",
    category: "guest_relations",
    title: "Send honeymoon follow-up note",
    detail: "Handwritten note sent after departure with invitation to return.",
    priority: "low",
    status: "resolved",
    ageHours: 52,
    assignedTo: "concierge"
  })
];
