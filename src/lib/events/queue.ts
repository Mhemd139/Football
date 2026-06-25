"use client";

import { syncAttendance, type AttendanceRow } from "./actions";

// Durable offline queue for attendance marks. A mark is keyed by its client_id
// (the same idempotency key the server upserts on), so re-marking a player
// offline overwrites in place — never a duplicate, end to end. enqueue resolves
// only once the IndexedDB transaction COMMITS, so an "saved" check awaiting it
// is honest even with no network.

// queued_at is bumped on every put. drainQueue deletes a row only if its
// queued_at still matches what it synced — so an edit re-queued (same client_id)
// during the network call is preserved, not clobbered by the post-sync delete.
type QueuedRow = AttendanceRow & { event_id: string; queued_at: number };

const DB_NAME = "tfc-attendance";
const STORE = "pending";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE, { keyPath: "client_id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Resolve on transaction commit (durability), not on request success.
function commit(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function readAll(store: IDBObjectStore): Promise<QueuedRow[]> {
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result as QueuedRow[]);
    request.onerror = () => reject(request.error);
  });
}

function read(
  store: IDBObjectStore,
  clientId: string,
): Promise<QueuedRow | undefined> {
  return new Promise((resolve, reject) => {
    const request = store.get(clientId);
    request.onsuccess = () => resolve(request.result as QueuedRow | undefined);
    request.onerror = () => reject(request.error);
  });
}

export async function enqueueAttendance(
  eventId: string,
  rows: AttendanceRow[],
): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);
  const queued_at = Date.now();
  for (const row of rows) store.put({ ...row, event_id: eventId, queued_at });
  await commit(tx);
  db.close();
}

// Push every pending row to the server, then delete only the rows the server
// confirmed. Rows enqueued during the network call survive. Safe to call on
// reconnect or app-open; idempotent via client_id.
export async function drainQueue(): Promise<void> {
  const db = await openDb();
  const pending = await readAll(db.transaction(STORE, "readonly").objectStore(STORE));
  if (pending.length === 0) {
    db.close();
    return;
  }

  const result = await syncAttendance(pending);
  if (!result.ok) {
    db.close();
    throw new Error(result.error);
  }

  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);
  for (const row of pending) {
    const current = await read(store, row.client_id);
    // a re-marked row was re-queued mid-sync (newer queued_at) — keep it.
    if (current && current.queued_at === row.queued_at) {
      store.delete(row.client_id);
    }
  }
  await commit(tx);
  db.close();
}

// For Home's "unsynced attendance" needs-attention item (M5).
export async function getQueuedCount(): Promise<number> {
  const db = await openDb();
  const count = await new Promise<number>((resolve, reject) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return count;
}
