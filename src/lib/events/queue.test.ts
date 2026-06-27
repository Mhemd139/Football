import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";

// Mock the server action — the queue's job is durability + dedup, NOT the network.
// syncAttendance is controllable per-test so we can drive success, failure, and
// the re-queue-mid-sync race.
const syncAttendance = vi.fn();
vi.mock("./actions", () => ({ syncAttendance: (...a: unknown[]) => syncAttendance(...a) }));

import {
  enqueueAttendance,
  drainQueue,
  getQueuedCount,
} from "./queue";

const row = (client_id: string, player_id = "p1") => ({
  player_id,
  status: "present" as const,
  client_id,
});

beforeEach(() => {
  // Fresh IndexedDB per test (fake-indexeddb gives us a resettable factory).
  indexedDB = new IDBFactory();
  syncAttendance.mockReset();
  syncAttendance.mockResolvedValue({ ok: true });
});

describe("enqueueAttendance — durability + dedup", () => {
  it("persists rows; getQueuedCount reflects them", async () => {
    await enqueueAttendance("e1", [row("c1"), row("c2", "p2")]);
    expect(await getQueuedCount()).toBe(2);
  });

  it("dedups on client_id — re-marking the same row overwrites, never duplicates", async () => {
    await enqueueAttendance("e1", [row("c1")]);
    await enqueueAttendance("e1", [{ ...row("c1"), status: "absent" }]);
    expect(await getQueuedCount()).toBe(1); // one row, latest wins
  });
});

describe("drainQueue — sync then delete-confirmed", () => {
  it("no-ops on an empty queue (no sync call)", async () => {
    await drainQueue();
    expect(syncAttendance).not.toHaveBeenCalled();
    expect(await getQueuedCount()).toBe(0);
  });

  it("clears the queue after a successful sync", async () => {
    await enqueueAttendance("e1", [row("c1"), row("c2", "p2")]);
    await drainQueue();
    expect(syncAttendance).toHaveBeenCalledOnce();
    expect(await getQueuedCount()).toBe(0);
  });

  it("keeps rows + throws on sync failure (no silent data loss)", async () => {
    syncAttendance.mockResolvedValue({ ok: false, error: "attendance.save_failed" });
    await enqueueAttendance("e1", [row("c1")]);
    await expect(drainQueue()).rejects.toThrow("attendance.save_failed");
    expect(await getQueuedCount()).toBe(1); // still queued — not lost
  });

  // The subtle race the queue is built to survive: a row re-marked DURING the
  // network call (same client_id, newer queued_at) must NOT be deleted by the
  // post-sync cleanup — its newer edit would be lost. queued_at is Date.now();
  // force the clock forward so the re-enqueue gets a strictly newer stamp (real
  // re-marks are seconds apart — fake-indexeddb ops are sub-millisecond, so
  // without this the two stamps collide and the guard can't tell them apart).
  it("preserves a row re-queued mid-sync (queued_at-match-before-delete)", async () => {
    let now = 1_000;
    const clock = vi.spyOn(Date, "now").mockImplementation(() => now);
    try {
      await enqueueAttendance("e1", [row("c1")]); // queued_at = 1000
      // While syncAttendance is in flight, the user re-marks c1 (newer queued_at).
      syncAttendance.mockImplementation(async () => {
        now = 2_000;
        await enqueueAttendance("e1", [{ ...row("c1"), status: "late" }]); // queued_at = 2000
        return { ok: true };
      });
      await drainQueue();
      // c1 was re-queued after the snapshot synced -> it survives the delete.
      expect(await getQueuedCount()).toBe(1);
    } finally {
      clock.mockRestore();
    }
  });
});
