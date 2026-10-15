import { useSyncExternalStore } from "react";

/** yes: a desktop Chromium browser · mobile: a phone or tablet · browser: a desktop browser that can't load Chrome extensions (Firefox, Safari). */
export type ExtensionSupport = "yes" | "mobile" | "browser";

/**
 * Can this browser run the Feedbeat Collector? It is a Manifest V3 Chrome
 * extension: desktop Chrome, Edge, Brave, Opera and other Chromium browsers.
 * Phones can't (Chrome on Android and iOS have no extensions), and Firefox and
 * Safari don't load it.
 */
export function extensionSupport({ userAgent, touchPoints = 0 }: { userAgent: string; touchPoints?: number }): ExtensionSupport {
  // iPadOS asks for the desktop site by default and then calls itself a Mac, but a Mac has no touch screen.
  if ((/Macintosh/.test(userAgent) && touchPoints > 1) || /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent)) return "mobile";
  return /Chrome\/\d/.test(userAgent) ? "yes" : "browser";
}

const subscribe = () => () => {};
const read = () => extensionSupport({ userAgent: navigator.userAgent, touchPoints: navigator.maxTouchPoints });

/** The answer for this browser; null while rendering on the server and during hydration. */
export function useExtensionSupport(): ExtensionSupport | null {
  return useSyncExternalStore(subscribe, read, () => null);
}
