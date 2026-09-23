import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const bridgeMocks = vi.hoisted(() => ({
  fetchAttachmentBlob: vi.fn(async () => new Blob(["file"], { type: "text/plain" })),
}));

vi.mock("@/lib/api", () => ({
  fetchAttachmentBlob: bridgeMocks.fetchAttachmentBlob,
}));

import { FileDownloaderBridge } from "@/lib/fileDownloaderBridge";
import { NotificationBridge } from "@/lib/notificationBridge";

type RuntimeWindow = Window & {
  __TAURI__?: unknown;
  __TAURI_INTERNALS__?: unknown;
  Capacitor?: {
    getPlatform?: () => string;
    isNativePlatform?: () => boolean;
  };
};

const runtimeWindow = window as RuntimeWindow;
const setWindowValue = (name: string, value: unknown) => {
  Object.defineProperty(window, name, { configurable: true, value, writable: true });
};
const setNavigatorValue = (name: string, value: unknown) => {
  Object.defineProperty(navigator, name, { configurable: true, value, writable: true });
};

beforeEach(() => {
  bridgeMocks.fetchAttachmentBlob.mockClear();
  Reflect.deleteProperty(runtimeWindow, "__TAURI__");
  Reflect.deleteProperty(runtimeWindow, "__TAURI_INTERNALS__");
  Reflect.deleteProperty(runtimeWindow, "Capacitor");
  Reflect.deleteProperty(navigator, "serviceWorker");
  Reflect.deleteProperty(navigator, "standalone");
  setWindowValue("Notification", undefined);
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("NotificationBridge", () => {
  test("detects tauri, capacitor, PWA, web, and unsupported runtimes", () => {
    expect(NotificationBridge.detectEnvironment()).toBe("unsupported");
    runtimeWindow.__TAURI_INTERNALS__ = {};
    expect(NotificationBridge.detectEnvironment()).toBe("tauri");
    Reflect.deleteProperty(runtimeWindow, "__TAURI_INTERNALS__");

    runtimeWindow.Capacitor = { isNativePlatform: () => true };
    expect(NotificationBridge.detectEnvironment()).toBe("capacitor");
    runtimeWindow.Capacitor = { isNativePlatform: () => false, getPlatform: () => "ios" };
    expect(NotificationBridge.detectEnvironment()).toBe("capacitor");
    runtimeWindow.Capacitor = { isNativePlatform: () => { throw new Error("bridge unavailable"); } };
    expect(NotificationBridge.detectEnvironment()).toBe("unsupported");
    Reflect.deleteProperty(runtimeWindow, "Capacitor");

    vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as MediaQueryList);
    expect(NotificationBridge.detectEnvironment()).toBe("pwa");
    vi.mocked(window.matchMedia).mockReturnValue({ matches: false } as MediaQueryList);
    setWindowValue("Notification", class {});
    expect(NotificationBridge.detectEnvironment()).toBe("web");
  });

  test("reads and requests permission, preserving the current state on failure", async () => {
    class FakeNotification {
      static permission: NotificationPermission = "default";
      static requestPermission = vi.fn(async () => "granted" as NotificationPermission);
    }
    setWindowValue("Notification", FakeNotification);

    expect(NotificationBridge.getPermission()).toBe("default");
    await expect(NotificationBridge.requestPermission()).resolves.toBe("granted");
    FakeNotification.permission = "denied";
    await expect(NotificationBridge.requestPermission()).resolves.toBe("denied");
    FakeNotification.permission = "default";
    FakeNotification.requestPermission.mockRejectedValueOnce(new Error("blocked"));
    await expect(NotificationBridge.requestPermission()).resolves.toBe("default");
  });

  test("uses a service worker and constrains notification navigation to this origin", async () => {
    class FakeNotification {
      static permission: NotificationPermission = "granted";
    }
    const showNotification = vi.fn(async () => undefined);
    setWindowValue("Notification", FakeNotification);
    setNavigatorValue("serviceWorker", {
      getRegistration: vi.fn(async () => ({ showNotification })),
    });

    await expect(NotificationBridge.send({
      title: "Message",
      body: "Hello",
      tag: "room-1",
      icon: "/icon.png",
      url: "https://evil.example/phish",
    })).resolves.toBe(true);

    expect(showNotification).toHaveBeenCalledWith("Message", expect.objectContaining({
      body: "Hello",
      tag: "room-1",
      icon: "/icon.png",
      data: { url: `${window.location.origin}/` },
    }));
  });

  test("falls back to the Notification API when persistent notification fails", async () => {
    const instances: Array<{ onclick: (() => void) | null; close: ReturnType<typeof vi.fn> }> = [];
    class FakeNotification {
      static permission: NotificationPermission = "granted";
      onclick: (() => void) | null = null;
      close = vi.fn();
      constructor(title: string, options?: NotificationOptions) {
        void title;
        void options;
        instances.push(this);
      }
    }
    setWindowValue("Notification", FakeNotification);
    setNavigatorValue("serviceWorker", {
      getRegistration: vi.fn(async () => ({
        showNotification: vi.fn(async () => { throw new Error("unsupported"); }),
      })),
    });

    await expect(NotificationBridge.send({
      title: "Message",
      body: "Hello",
      url: "/rooms/room-1",
    })).resolves.toBe(true);
    expect(instances).toHaveLength(1);
    expect(instances[0].onclick).toEqual(expect.any(Function));
  });

  test("returns false without permission or when construction fails", async () => {
    await expect(NotificationBridge.send({ title: "Message", body: "Hello" })).resolves.toBe(false);
    class BrokenNotification {
      static permission: NotificationPermission = "granted";
      constructor() {
        throw new Error("unsupported");
      }
    }
    setWindowValue("Notification", BrokenNotification);
    await expect(NotificationBridge.send({ title: "Message", body: "Hello" })).resolves.toBe(false);
  });
});

describe("FileDownloaderBridge", () => {
  test("detects web, PWA, tauri, and capacitor platforms", () => {
    expect(FileDownloaderBridge.detectPlatform()).toBe("web");
    vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as MediaQueryList);
    expect(FileDownloaderBridge.detectPlatform()).toBe("pwa");
    vi.mocked(window.matchMedia).mockReturnValue({ matches: false } as MediaQueryList);
    runtimeWindow.__TAURI__ = {};
    expect(FileDownloaderBridge.detectPlatform()).toBe("tauri");
    Reflect.deleteProperty(runtimeWindow, "__TAURI__");
    runtimeWindow.Capacitor = { getPlatform: () => "android" };
    expect(FileDownloaderBridge.detectPlatform()).toBe("capacitor");
  });

  test("delegates native downloads and unregisters only the current adapter", async () => {
    runtimeWindow.__TAURI__ = {};
    const first = { download: vi.fn(async () => undefined) };
    const second = { download: vi.fn(async () => undefined) };
    const unregisterFirst = FileDownloaderBridge.registerAdapter("tauri", first);
    const unregisterSecond = FileDownloaderBridge.registerAdapter("tauri", second);

    unregisterFirst();
    await FileDownloaderBridge.download("/file", "file.txt");
    expect(first.download).not.toHaveBeenCalled();
    expect(second.download).toHaveBeenCalledWith("/file", "file.txt");
    unregisterSecond();
  });

  test("downloads through a temporary browser link and revokes the object URL", async () => {
    vi.useFakeTimers();
    const createObjectURL = vi.fn(() => "blob:download");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    await FileDownloaderBridge.download("/file", "report.txt");

    expect(bridgeMocks.fetchAttachmentBlob).toHaveBeenCalledWith("/file");
    expect(click).toHaveBeenCalledTimes(1);
    expect(document.querySelector('a[download="report.txt"]')).toBeNull();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:download");
  });

  test("rejects a browser download when object URLs are unavailable", async () => {
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: undefined });
    await expect(FileDownloaderBridge.download("/file", "file.txt")).rejects.toThrow(
      "File downloads are not supported in this environment",
    );
  });
});
