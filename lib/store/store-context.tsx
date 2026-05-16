"use client";

import { createContext, useContext, useMemo, useReducer } from "react";
import { guestFixtures } from "@/lib/fixtures/guests";
import { staffFixtures } from "@/lib/fixtures/staff";
import { ticketFixtures } from "@/lib/fixtures/tickets";
import { guestCrmReducer, type GuestCrmAction } from "@/lib/store/reducer";
import type { GuestCrmState } from "@/lib/types";

export const initialGuestCrmState: GuestCrmState = {
  guests: guestFixtures,
  tickets: ticketFixtures,
  staff: staffFixtures,
  focusedGuestId: undefined,
  detailGuestId: undefined,
  focusedTicketId: undefined,
  newTicketOpen: false,
  newTicketDraft: undefined,
  unfiledNotes: []
};

interface GuestCrmContextValue {
  state: GuestCrmState;
  dispatch: React.Dispatch<GuestCrmAction>;
  replaceStore: (initialState: GuestCrmState) => void;
}

const GuestCrmContext = createContext<GuestCrmContextValue | null>(null);

export function GuestCrmProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(guestCrmReducer, initialGuestCrmState);

  const value = useMemo<GuestCrmContextValue>(
    () => ({
      state,
      dispatch,
      replaceStore: (initialState) => dispatch({ type: "REPLACE_STORE", payload: initialState })
    }),
    [state]
  );

  return <GuestCrmContext.Provider value={value}>{children}</GuestCrmContext.Provider>;
}

export function useGuestCrm() {
  const context = useContext(GuestCrmContext);
  if (!context) {
    throw new Error("useGuestCrm must be used inside GuestCrmProvider");
  }
  return context;
}
