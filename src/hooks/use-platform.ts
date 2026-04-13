"use client";

import { useEffect, useState } from "react";

// Returns the OS-appropriate label for the palette modifier: "⌘K" on macOS,
// "Ctrl+K" everywhere else. Defaults to the mac form on initial render so
// the server-rendered markup is stable, then upgrades after mount for
// Windows/Linux clients. Hydration is safe because the first client render
// matches the server output.
export function useModifierLabel(): string {
  const [label, setLabel] = useState("⌘K");
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const ua = navigator.userAgent;
    const isMac = /Mac|iPhone|iPad|iPod/i.test(ua);
    if (!isMac) setLabel("Ctrl+K");
  }, []);
  return label;
}
