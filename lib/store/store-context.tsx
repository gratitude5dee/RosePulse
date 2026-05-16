"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import { guestFixtures } from "@/lib/fixtures/guests";
import { staffFixtures } from "@/lib/fixtures/staff";
import { ticketFixtures } from "@/lib/fixtures/tickets";
import { createFixturePreferences, createFixtureRecommendations } from "@/lib/preference-intelligence";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { loadGuestCrmState, persistGuestCrmAction } from "@/lib/supabase/queries";
import { subscribeToGuestCrmChanges } from "@/lib/supabase/realtime";
import { guestCrmReducer, type GuestCrmAction } from "@/lib/store/reducer";
import type { GuestCrmState } from "@/lib/types";

const fixturePreferences = createFixturePreferences(guestFixtures, ticketFixtures);

export const initialGuestCrmState: GuestCrmState = {
  guests: guestFixtures,
  tickets: ticketFixtures,
  staff: staffFixtures,
  preferences: fixturePreferences,
  recommendations: createFixtureRecommendations(guestFixtures, fixturePreferences),
  focusedGuestId: undefined,
  detailGuestId: undefined,
  focusedTicketId: undefined,
  newTicketOpen: false,
  newTicketDraft: undefined,
  unfiledNotes: [],
  backend: {
    mode: isSupabaseConfigured() ? "supabase" : "fixtures",
    status: "idle",
    pendingActions: 0,
    message: isSupabaseConfigured() ? "Supabase configured" : "Running from seeded fixtures"
  }
};

interface GuestCrmContextValue {
  state: GuestCrmState;
  dispatch: React.Dispatch<GuestCrmAction>;
  replaceStore: (initialState: GuestCrmState) => void;
}

const GuestCrmContext = createContext<GuestCrmContextValue | null>(null);

export function GuestCrmProvider({ children }: { children: React.ReactNode }) {
  const [state, baseDispatch] = useReducer(guestCrmReducer, initialGuestCrmState);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const refreshFromSupabase = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    baseDispatch({ type: "SET_BACKEND_SYNC", payload: { mode: "supabase", status: "hydrating", message: "Refreshing live operations" } });
    const remoteState = await loadGuestCrmState(stateRef.current);
    baseDispatch({
      type: "REPLACE_STORE",
      payload: {
        ...remoteState,
        backend: {
          mode: "supabase",
          status: "synced",
          pendingActions: 0,
          lastSyncedAt: new Date().toISOString(),
          message: "Synced with Supabase"
        }
      }
    });
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let active = true;
    void refreshFromSupabase().catch((error: unknown) => {
      if (!active) return;
      baseDispatch({
        type: "SET_BACKEND_SYNC",
        payload: {
          mode: "supabase",
          status: "error",
          message: error instanceof Error ? error.message : "Supabase hydration failed"
        }
      });
    });
    const unsubscribe = subscribeToGuestCrmChanges(() => {
      void refreshFromSupabase();
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [refreshFromSupabase]);

  const dispatch = useCallback<React.Dispatch<GuestCrmAction>>((action) => {
    baseDispatch(action);

    if (!isSupabaseConfigured()) return;

    const persistable = persistGuestCrmAction(action, stateRef.current);
    if (!persistable) return;

    baseDispatch({
      type: "SET_BACKEND_SYNC",
      payload: {
        mode: "supabase",
        status: "syncing",
        pendingActions: stateRef.current.backend.pendingActions + 1,
        message: "Saving to Supabase"
      }
    });

    void persistable
      .then(() => {
        baseDispatch({
          type: "SET_BACKEND_SYNC",
          payload: {
            status: "synced",
            pendingActions: Math.max(0, stateRef.current.backend.pendingActions - 1),
            lastSyncedAt: new Date().toISOString(),
            message: "Saved to Supabase"
          }
        });
      })
      .catch((error: unknown) => {
        baseDispatch({
          type: "SET_BACKEND_SYNC",
          payload: {
            status: "error",
            pendingActions: Math.max(0, stateRef.current.backend.pendingActions - 1),
            message: error instanceof Error ? error.message : "Supabase write failed"
          }
        });
      });
  }, []);

  const value = useMemo<GuestCrmContextValue>(
    () => ({
      state,
      dispatch,
      replaceStore: (initialState) => baseDispatch({ type: "REPLACE_STORE", payload: initialState })
    }),
    [dispatch, state]
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
