import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";

// Performance BUDGET, not a load test. The North Star is "attendance for 22
// players in <=60s" — a client interaction budget. This guards the QUEUE's
// contribution to it: enqueuing + draining a full 22-row roster must stay fast
// and must NOT degrade super-linearly. The threshold is deliberately generous
// (orders of magnitude above expected) so it fires only on a real algorithmic
// regression (e.g. an accidental O(n^2) drain or a per-row network round-trip),
// never on a slow CI box. The true end-to-end 60s gate stays a human on-phone
// test (Atlas's M3 checklist) — a unit test can't measure thumb-reach.

const syncAttendance = vi.fn();
vi.mock("./actions", () => ({ syncAttendance: (...a: unknown[]) => syncAttendance(...a) }));

import { enqueueAttendance, drainQueue, getQueuedCount } from "./queue";

const roster = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    player_id: `p${i}`,
    status: "present" as const,
    client_id: `c${i}`,
  }));

beforeEach(() => {
  indexedDB = new IDBFactory();
  syncAttendance.mockReset();
  syncAttendance.mockResolvedValue({ ok: true });
});

describe("queue performance budget (22-player roster)", () => {
  const ROSTER = 22;
  const BUDGET_MS = 500; // generous: real local ops are single-digit ms

  it(`enqueue + drain ${ROSTER} rows well under ${BUDGET_MS}ms`, async () => {
    const start = performance.now();
    await enqueueAttendance("e1", roster(ROSTER));
    await drainQueue();
    const elapsed = performance.now() - start;

    expect(await getQueuedCount()).toBe(0); // correctness alongside speed
    expect(elapsed).toBeLessThan(BUDGET_MS);
  });

  it("scales ~linearly: 4x the roster is not >10x the time (no O(n^2) drain)", async () => {
    const time = async (n: number) => {
      indexedDB = new IDBFactory();
      const start = performance.now();
      await enqueueAttendance("e1", roster(n));
      await drainQueue();
      return performance.now() - start;
    };
    const small = await time(ROSTER); // 22
    const big = await time(ROSTER * 4); // 88

    // 4x work should be roughly 4x time; allow 10x slack for noise/fixed costs.
    // A super-linear blowup (quadratic drain) would exceed this.
    expect(big).toBeLessThan(small * 10 + 50);
  });
});
