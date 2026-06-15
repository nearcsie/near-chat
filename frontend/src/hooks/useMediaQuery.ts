"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Subscribe to a CSS media query and return whether it currently matches.
 *
 * Built on `useSyncExternalStore`, the React-recommended way to read from an
 * external store (here, `matchMedia`) without a `setState`-in-effect. The
 * server snapshot returns `false` so the first render assumes the desktop
 * layout and hydration stays consistent across the most common viewport.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const mediaQueryList = window.matchMedia(query);
      mediaQueryList.addEventListener("change", onStoreChange);
      return () => mediaQueryList.removeEventListener("change", onStoreChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);
  const getServerSnapshot = () => false;

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Tailwind `md` breakpoint is 768px, so "mobile" is anything narrower. */
export const MOBILE_MEDIA_QUERY = "(max-width: 767px)";

/** True on phone-sized viewports (< 768px). */
export function useIsMobile(): boolean {
  return useMediaQuery(MOBILE_MEDIA_QUERY);
}
