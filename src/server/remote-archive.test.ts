import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { fetchArchiveRange, isPublicAddress } = await import("./remote-archive");

describe("isPublicAddress", () => {
  it.each(["1.1.1.1", "142.250.80.46", "2606:4700:4700::1111", "::ffff:8.8.8.8"])("allows %s", (ip) => {
    expect(isPublicAddress(ip)).toBe(true);
  });

  it.each(["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:a9fe:a9fe", "nope"])(
    "blocks %s",
    (ip) => {
      expect(isPublicAddress(ip)).toBe(false);
    },
  );
});

describe("fetchArchiveRange", () => {
  it("refuses private and loopback targets before connecting", async () => {
    await expect(fetchArchiveRange("https://127.0.0.1/a.zip", 0, 0)).rejects.toThrow(/private/);
    await expect(fetchArchiveRange("https://[::1]/a.zip", 0, 0)).rejects.toThrow(/private/);
    await expect(fetchArchiveRange("https://localhost/a.zip", 0, 0)).rejects.toThrow(/private|find/);
  });

  it("rejects oversized ranges", async () => {
    await expect(fetchArchiveRange("https://example.com/a.zip", 0, 64 * 1024 * 1024)).rejects.toThrow(/range/);
  });
});
