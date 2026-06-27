import { describe, it, expect } from "vitest";
import { scrub } from "./sentry-options";

// Proves the harness runs AND that the PII scrub actually protects minors' data
// before any event leaves the device.
describe("scrub", () => {
  it("redacts PII keys at any depth", () => {
    const event = {
      player: {
        full_name: "Test Player",
        national_id: "123456789",
        guardian_phone: "+972500000000",
      },
      roster: [{ phone: "+972511111111", jersey_number: 7 }],
    };

    const cleaned = scrub(event) as typeof event;

    expect(cleaned.player.national_id).toBe("[scrubbed]");
    expect(cleaned.player.guardian_phone).toBe("[scrubbed]");
    expect(cleaned.roster[0].phone).toBe("[scrubbed]");
    // Non-PII is preserved — we scrub fields, not whole payloads.
    expect(cleaned.player.full_name).toBe("Test Player");
    expect(cleaned.roster[0].jersey_number).toBe(7);
  });

  it("passes primitives through untouched", () => {
    expect(scrub("hello")).toBe("hello");
    expect(scrub(42)).toBe(42);
    expect(scrub(null)).toBe(null);
  });
});
