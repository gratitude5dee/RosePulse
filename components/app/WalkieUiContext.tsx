"use client";

import { createContext, useContext } from "react";

import type { TicketCategory } from "@/lib/types";

export interface WalkieOpenTarget {
  guestId?: string;
  ticketId?: string;
  category?: TicketCategory;
}

interface WalkieUiContextValue {
  target?: WalkieOpenTarget;
  openWalkie: (target?: WalkieOpenTarget) => void;
  closeMobileWalkie: () => void;
  expandDesktopRail: () => void;
}

const noop = () => undefined;

const WalkieUiContext = createContext<WalkieUiContextValue>({
  openWalkie: noop,
  closeMobileWalkie: noop,
  expandDesktopRail: noop
});

export function WalkieUiProvider({
  value,
  children
}: {
  value: WalkieUiContextValue;
  children: React.ReactNode;
}) {
  return <WalkieUiContext.Provider value={value}>{children}</WalkieUiContext.Provider>;
}

export function useWalkieUi() {
  return useContext(WalkieUiContext);
}
