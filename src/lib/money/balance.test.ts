import { describe, it, expect } from "vitest";
import { money, sumPayments, deriveStatus, isPastDue, remaining, monthDueDate } from "./balance";

// The highest-consequence logic in the app: what a parent owes. A rounding or
// status bug here is the "3am sign bug" the two-table money design exists to
// prevent. These run DB-free.

describe("money()", () => {
  it("rounds to 2dp (agora precision)", () => {
    expect(money(150)).toBe(150);
    expect(money("150.00")).toBe(150); // PostgREST may send numeric as string
    expect(money(150.005)).toBe(150.01);
    expect(money(150.004)).toBe(150);
  });

  it("keeps float sums exact (no 0.30000000000000004)", () => {
    expect(money(0.1 + 0.2)).toBe(0.3);
  });
});

describe("sumPayments()", () => {
  it("is 0 over no payments", () => {
    expect(sumPayments([])).toBe(0);
  });

  it("sums partial payments exactly", () => {
    expect(sumPayments([{ amount: 50 }, { amount: 50.5 }, { amount: "49.5" }])).toBe(150);
  });

  it("does not accumulate float error across many small payments", () => {
    const ten = Array.from({ length: 10 }, () => ({ amount: 0.1 }));
    expect(sumPayments(ten)).toBe(1);
  });
});

describe("isPastDue()", () => {
  it("is true when the due date is strictly before today", () => {
    expect(isPastDue("2026-06-01", "2026-06-27")).toBe(true);
  });
  it("is false on the due date itself (not yet overdue)", () => {
    expect(isPastDue("2026-06-27", "2026-06-27")).toBe(false);
  });
  it("is false for a future due date", () => {
    expect(isPastDue("2026-07-10", "2026-06-27")).toBe(false);
  });
});

describe("deriveStatus()", () => {
  const today = "2026-06-27";
  it("paid when payments cover the full amount", () => {
    expect(deriveStatus(150, 150, "2026-06-10", today)).toBe("paid");
  });
  it("paid on overpayment", () => {
    expect(deriveStatus(150, 200, "2026-06-10", today)).toBe("paid");
  });
  it("partial when some but not all is paid", () => {
    expect(deriveStatus(150, 50, "2026-07-10", today)).toBe("partial");
  });
  it("overdue when unpaid and past the due date", () => {
    expect(deriveStatus(150, 0, "2026-06-10", today)).toBe("overdue");
  });
  it("upcoming when unpaid and the due date is still ahead", () => {
    expect(deriveStatus(150, 0, "2026-07-10", today)).toBe("upcoming");
  });
});

describe("remaining()", () => {
  it("is due minus paid, rounded", () => {
    expect(remaining(150, 50)).toBe(100);
    expect(remaining(150, 150)).toBe(0);
  });
  // Documents CURRENT behavior (faithful to actions.ts): overpay -> negative.
  // Keeper has flagged this edge to Sweeper/Atlas; the test guards the behavior
  // as it is, and will fail loudly if someone changes it without a decision.
  it("goes negative on overpayment (flagged edge, current behavior)", () => {
    expect(remaining(150, 200)).toBe(-50);
  });
});

describe("monthDueDate()", () => {
  it("is the 10th of the period's month (UTC)", () => {
    expect(monthDueDate("2026-06-01")).toBe("2026-06-10");
    expect(monthDueDate("2026-12-01")).toBe("2026-12-10");
  });
});
