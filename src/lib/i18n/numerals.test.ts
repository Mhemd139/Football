import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fmtNumber } from "./numerals";

// Atlas's western-numerals rule: render 3,500 not ٣٬٥٠٠ even in Arabic UI, and
// keep numerals LTR-isolated in RTL via the `.num` span. The two halves:
//   1. fmtNumber must ALWAYS emit Western digits (the JS half).
//   2. the `.num` CSS rule must keep direction:ltr + bidi isolation (the CSS half).

describe("fmtNumber — always Western digits", () => {
  it("emits Western numerals with thousands grouping", () => {
    expect(fmtNumber(3500)).toBe("3,500");
    expect(fmtNumber(150)).toBe("150");
    expect(fmtNumber(1234567)).toBe("1,234,567");
  });

  it("contains no Arabic-Indic digits (٠-٩)", () => {
    const out = fmtNumber(3500);
    expect(/[٠-٩]/.test(out)).toBe(false); // Arabic-Indic
    expect(/[۰-۹]/.test(out)).toBe(false); // Extended Arabic-Indic
  });

  it("handles zero and negatives without locale digits", () => {
    expect(fmtNumber(0)).toBe("0");
    expect(fmtNumber(-50)).toBe("-50");
  });
});

describe(".num CSS contract (the LTR-isolation guarantee)", () => {
  const css = readFileSync(resolve(__dirname, "../../app/globals.css"), "utf8");

  it("the .num rule keeps direction:ltr and bidi isolation", () => {
    const block = css.match(/\.num\s*\{[^}]*\}/);
    expect(block, ".num rule must exist in globals.css").not.toBeNull();
    expect(block![0]).toMatch(/direction:\s*ltr/);
    expect(block![0]).toMatch(/unicode-bidi:\s*isolate/);
  });
});
