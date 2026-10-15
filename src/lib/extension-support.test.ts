import { describe, expect, it } from "vitest";
import { extensionSupport } from "./extension-support";

const UA = {
  chromeMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  edgeWindows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
  headlessChrome: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/119.0.6045.9 Safari/537.36",
  firefox: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:131.0) Gecko/20100101 Firefox/131.0",
  safariMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  chromeAndroid: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  chromeAndroidTablet: "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  safariIphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  chromeIphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.0.0 Mobile/15E148 Safari/604.1",
};

describe("extensionSupport", () => {
  it("accepts desktop Chromium browsers", () => {
    expect(extensionSupport({ userAgent: UA.chromeMac })).toBe("yes");
    expect(extensionSupport({ userAgent: UA.edgeWindows })).toBe("yes");
    expect(extensionSupport({ userAgent: UA.headlessChrome })).toBe("yes");
  });

  it("sends phones and tablets to the alternative, even in Chrome", () => {
    expect(extensionSupport({ userAgent: UA.chromeAndroid })).toBe("mobile");
    expect(extensionSupport({ userAgent: UA.chromeAndroidTablet })).toBe("mobile");
    expect(extensionSupport({ userAgent: UA.safariIphone })).toBe("mobile");
    expect(extensionSupport({ userAgent: UA.chromeIphone })).toBe("mobile");
  });

  it("recognizes an iPad that asks for the desktop site", () => {
    expect(extensionSupport({ userAgent: UA.safariMac, touchPoints: 5 })).toBe("mobile");
    expect(extensionSupport({ userAgent: UA.safariMac, touchPoints: 0 })).toBe("browser");
  });

  it("rejects desktop browsers that can't load Chrome extensions", () => {
    expect(extensionSupport({ userAgent: UA.firefox })).toBe("browser");
    expect(extensionSupport({ userAgent: UA.safariMac })).toBe("browser");
  });
});
