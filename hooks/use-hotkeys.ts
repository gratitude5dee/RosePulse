"use client";

import { useEffect } from "react";

interface HotkeyHandlers {
  onCommandK?: () => void;
  onEscape?: () => void;
}

export function useHotkeys({ onCommandK, onEscape }: HotkeyHandlers) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onCommandK?.();
      }
      if (event.key === "Escape") {
        onEscape?.();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCommandK, onEscape]);
}
