import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { MOBILE_MEDIA_QUERY, useIsMobile, useMediaQuery } from "@/hooks/useMediaQuery";
import { resolveAssetUrl } from "@/lib/assets";
import {
  DEFAULT_LOCALE,
  getServerLocale,
  getStoredLocale,
  isLocale,
  setStoredLocale,
  subscribeToLocale,
  translate,
} from "@/lib/i18n";
import {
  getServerRedirect,
  readRedirectParam,
  sanitizeRedirect,
  subscribeToRedirect,
  withRedirectParam,
} from "@/lib/redirect";

afterEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/");
});

describe("localization helpers", () => {
  test("resolves locales, fallbacks, replacements, and invalid keys", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("zh-TW")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(translate("en", "common.online")).toBe("Online");
    expect(translate("zh-TW", "common.online")).toBe("線上");
    expect(translate("fr", "common.online")).toBe("線上");
    expect(translate("en", "emergency.alertSent", { count: 3 })).toBe(
      "Emergency alert sent to 3 contact(s).",
    );
    expect(translate("en", "common")).toBe("common");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(translate("en", "missing.key")).toBe("missing.key");
    expect(warn).toHaveBeenCalledTimes(1);
  });

  test("persists a locale and notifies same-tab and storage subscribers", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToLocale(listener);

    setStoredLocale("en");
    window.dispatchEvent(new StorageEvent("storage", { key: "language" }));

    expect(getStoredLocale()).toBe("en");
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    setStoredLocale("zh-TW");
    expect(listener).toHaveBeenCalledTimes(2);
    expect(getServerLocale()).toBe(DEFAULT_LOCALE);
  });

  test("falls back when storage reads or writes are unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(getStoredLocale()).toBe(DEFAULT_LOCALE);
    vi.restoreAllMocks();

    const listener = vi.fn();
    const unsubscribe = subscribeToLocale(listener);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    setStoredLocale("en");
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});

describe("safe redirect helpers", () => {
  test.each([
    [null, "/"],
    ["", "/"],
    ["https://evil.example", "/"],
    ["//evil.example/path", "/"],
    ["/\\evil.example", "/"],
    ["/login", "/"],
    ["/register/", "/"],
    ["/rooms/room-1?tab=files#latest", "/rooms/room-1?tab=files#latest"],
    ["/rooms///", "/rooms///"],
  ])("sanitizes %s", (raw, expected) => {
    expect(sanitizeRedirect(raw)).toBe(expected);
  });

  test("reads the current query and builds links without creating auth loops", () => {
    window.history.replaceState({}, "", "/login?redirect=%2Frooms%2Froom-1%3Ftab%3Dfiles");
    expect(readRedirectParam()).toBe("/rooms/room-1?tab=files");
    expect(getServerRedirect()).toBe("/");
    expect(withRedirectParam("/login", "/rooms/room-1")).toBe(
      "/login?redirect=%2Frooms%2Froom-1",
    );
    expect(withRedirectParam("/login", "/")).toBe("/login");
    expect(withRedirectParam("/login", "")).toBe("/login");
    expect(subscribeToRedirect()()).toBeUndefined();
  });
});

describe("asset URL resolution", () => {
  test("accepts API-relative and safe absolute asset URLs", () => {
    expect(resolveAssetUrl()).toBeUndefined();
    expect(resolveAssetUrl("   ")).toBeUndefined();
    expect(resolveAssetUrl(" /uploads/avatar.png ")).toBe(
      new URL("/uploads/avatar.png", "http://localhost:4000").toString(),
    );
    expect(resolveAssetUrl("https://cdn.example.test/a.png")).toBe(
      "https://cdn.example.test/a.png",
    );
    expect(resolveAssetUrl("blob:https://app.example.test/id")).toBe(
      "blob:https://app.example.test/id",
    );
    expect(resolveAssetUrl("javascript:alert(1)")).toBeUndefined();
    expect(resolveAssetUrl("not a url")).toBeUndefined();
  });
});

describe("media query hooks", () => {
  test("subscribes, reflects changes, and removes its listener on unmount", () => {
    let matches = false;
    let changeListener: (() => void) | undefined;
    const addEventListener = vi.fn((_event: string, listener: () => void) => {
      changeListener = listener;
    });
    const removeEventListener = vi.fn();
    vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener,
      removeEventListener,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    function Probe() {
      const custom = useMediaQuery("(min-width: 1000px)");
      const mobile = useIsMobile();
      return <div>{String(custom)}:{String(mobile)}</div>;
    }

    const view = render(<Probe />);
    expect(screen.getByText("false:false")).toBeTruthy();
    expect(window.matchMedia).toHaveBeenCalledWith(MOBILE_MEDIA_QUERY);
    matches = true;
    act(() => changeListener?.());
    expect(screen.getByText("true:true")).toBeTruthy();
    view.unmount();
    expect(removeEventListener).toHaveBeenCalled();
  });
});
