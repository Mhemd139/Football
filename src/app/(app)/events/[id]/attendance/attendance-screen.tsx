"use client";

import { useState, useMemo, useCallback, useEffect, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  saveAttendance,
  type AttendanceStatus,
  type AttendanceRow,
} from "@/lib/events/actions";
import { enqueueAttendance, drainQueue } from "@/lib/events/queue";
import {
  motion,
  AnimatePresence,
  useReducedMotion,
  EASE,
  BottomSheet,
} from "@/components/motion/primitives";
import { SuccessCheck } from "@/components/motion/success-check";

// The North Star screen: mark a roster present/late/absent in <60s, offline-safe.
// Atlas ruling (2026-06-24): default-present · "الكل حاضر" = fill-not-lock ·
// 3 separate ≥44px targets · optimistic per-tap FEEL + ONE atomic save on حفظ.
// ONLINE → saveAttendance (a failure is a real error, never a fake "saved").
// OFFLINE → enqueueAttendance to the durable IndexedDB queue (resolves on commit,
// so the confident success is honest) + drainQueue when the network returns.

export type EventMeta = {
  teamName: string;
  title: string;
  type: "training" | "match";
  starts_at: string;
  location: string | null;
};

export type RosterPlayer = {
  player_id: string;
  full_name: string;
  jersey_number: number | null;
  status: AttendanceStatus | null;
};

// One row's working state. `touched` drives the bulk-fill (only untouched rows
// get filled) and the save count (how many the coach has consciously set).
// `client_id` is stable for the row's lifetime — generated ONCE so a re-save
// upserts the SAME attendance row (the DB dedups on client_id, NOT on
// (event,player)) instead of inserting a duplicate. `recorded_at` is the moment
// the coach marked it (tap-time), so capture time stays truthful on replay.
type Mark = {
  status: AttendanceStatus;
  touched: boolean;
  minutes: number | null;
  cause: string | null;
  client_id: string;
  recorded_at: string | null;
};

const MINUTES = [5, 10, 15, 20, 30];
const CAUSES_LATE = ["transport", "school", "late_practice", "other"] as const;
const CAUSES_ABSENT = ["illness", "injury", "school", "family", "no_permission", "other"] as const;

export function AttendanceScreen({
  eventId,
  event,
  roster,
  loadError,
}: {
  eventId: string;
  event: EventMeta;
  roster: RosterPlayer[];
  loadError: string | null;
}) {
  const t = useTranslations("attendance");
  const te = useTranslations("events");
  const router = useRouter();
  const reduce = useReducedMotion();

  // default-present: any player with no existing mark starts present (Atlas ②).
  // Each row gets ONE stable client_id at init, reused on every save so the DB
  // upsert updates the same row instead of duplicating (no UNIQUE(event,player)).
  const [marks, setMarks] = useState<Mark[]>(() =>
    roster.map((p) => ({
      status: p.status ?? "present",
      touched: p.status != null, // a pre-existing mark counts as already set
      minutes: null,
      cause: null,
      client_id: crypto.randomUUID(),
      recorded_at: null,
    })),
  );
  const [sheetIdx, setSheetIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [savedOffline, setSavedOffline] = useState(false);
  const online = useOnline();

  // Drain any queued offline marks when the network returns (and on mount, in
  // case a prior offline save is still pending). Idempotent — safe to over-call.
  useEffect(() => {
    if (online) void drainQueue().catch(() => {});
  }, [online]);

  const counts = useMemo(() => {
    const c = { present: 0, late: 0, absent: 0, touched: 0 };
    for (const m of marks) {
      c[m.status]++;
      if (m.touched) c.touched++;
    }
    return c;
  }, [marks]);

  // set one row's status; late/absent opens the reason sheet (unless from sheet).
  // No edits while a save is in flight — otherwise the success breakdown could
  // report counts that differ from the rows actually sent.
  const setStatus = useCallback(
    (i: number, status: AttendanceStatus, fromSheet = false) => {
      if (saving) return;
      setMarks((prev) => {
        const next = [...prev];
        // stamp capture time at the tap (truthful on offline replay), not at save
        const m = { ...next[i], status, touched: true, recorded_at: new Date().toISOString() };
        if (status === "present") {
          m.minutes = null;
          m.cause = null;
        }
        next[i] = m;
        return next;
      });
      if (!fromSheet && (status === "late" || status === "absent")) setSheetIdx(i);
    },
    [saving],
  );

  // الكل حاضر — fill, not lock: only untouched rows become present (Atlas ①)
  const markAllPresent = useCallback(() => {
    if (saving) return;
    const now = new Date().toISOString();
    setMarks((prev) =>
      prev.map((m) =>
        m.touched ? m : { ...m, status: "present", touched: true, recorded_at: now },
      ),
    );
  }, [saving]);

  async function onSave() {
    setSaving(true);
    setSaveError(null);
    const rows: AttendanceRow[] = roster.map((p, i) => ({
      player_id: p.player_id,
      status: marks[i].status,
      reason_minutes: marks[i].minutes,
      reason_cause: marks[i].cause,
      client_id: marks[i].client_id, // stable per row → re-save updates, never duplicates
      recorded_at: marks[i].recorded_at, // tap-time, or null → DB default on first save
    }));

    // OFFLINE: persist to the durable IndexedDB queue. enqueueAttendance resolves
    // only on transaction COMMIT, so the confident success below is honest — the
    // rows survive tab-close/reload (Atlas's durability ruling). drainQueue runs
    // when the network returns.
    if (!online) {
      try {
        await enqueueAttendance(eventId, rows);
        setSaving(false);
        setSavedOffline(true);
        setDone(true);
      } catch {
        setSaving(false);
        setSaveError(t("save_failed")); // durable write failed → real error, no fake green
      }
      return;
    }

    // ONLINE: one atomic write. A failure is a real error, never a fake success.
    const res = await saveAttendance(eventId, rows);
    setSaving(false);
    if (!res.ok) {
      setSaveError(t(res.error.startsWith("attendance.") ? res.error.slice(11) : "save_failed"));
      return;
    }
    setSavedOffline(false);
    setDone(true);
  }

  if (loadError) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col" dir="rtl">
        <Header event={event} t={t} te={te} counts={counts} total={roster.length} touched={counts.touched} />
        <ErrorState message={loadError} onRetry={() => router.refresh()} t={t} />
      </main>
    );
  }

  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-2xl flex-col" dir="rtl">
      <Header event={event} t={t} te={te} counts={counts} total={roster.length} touched={counts.touched} />

      {!online && (
        <div className="flex items-center justify-center gap-2 bg-[#FEF3E2] px-5 py-2 text-[11.5px] font-semibold text-[#B45309]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth="2" aria-hidden="true">
            <path d="M1 1l22 22M16.7 16.7A6 6 0 0118 12M5 12a8 8 0 018-8M8.5 8.5A4 4 0 0012 16" />
          </svg>
          {t("offline_banner")}
        </div>
      )}

      {roster.length === 0 ? (
        <EmptyState t={t} />
      ) : (
        <>
          {/* bulk action */}
          <div className="flex items-center gap-2.5 px-5 pb-1 pt-3">
            <button
              type="button"
              onClick={markAllPresent}
              disabled={saving}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[#CDEFDD] bg-[#E7F8F0] text-sm font-bold text-[#047857] transition-transform active:scale-[0.97] disabled:opacity-60"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#047857" strokeWidth="2.4" aria-hidden="true">
                <path d="M4 12l5 5L20 6" />
              </svg>
              {t("mark_all_present")}
            </button>
            <span className="text-[10.5px] text-[#5E6E80]">{t("mark_all_hint")}</span>
          </div>

          {/* roster */}
          <div className="flex-1 px-5 pb-28 pt-2">
            <ul className="flex flex-col gap-2">
              {roster.map((p, i) => (
                <motion.li
                  key={p.player_id}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.26, ease: EASE, delay: reduce ? 0 : Math.min(i * 0.03, 0.3) }}
                >
                  <PlayerRow
                    player={p}
                    mark={marks[i]}
                    onSet={(st) => setStatus(i, st)}
                    t={t}
                  />
                </motion.li>
              ))}
            </ul>
          </div>

          {/* save bar */}
          <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-2xl border-t border-[#EAEFF4] bg-white px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
            {saveError && (
              <p role="alert" className="mb-2 text-center text-xs font-semibold text-[#C0392B]">
                {saveError}
              </p>
            )}
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="flex h-[52px] w-full items-center justify-center gap-2.5 rounded-2xl text-[15px] font-bold text-white shadow-[0_8px_20px_rgba(4,120,87,0.28)] transition-transform active:scale-[0.98] disabled:opacity-70"
              style={{ background: "#047857" }}
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" aria-hidden="true">
                <path d="M4 12l5 5L20 6" />
              </svg>
              <span>
                {saving ? t("saving") : t("save")}{" "}
                <span className="num">{t("save_count", { done: counts.touched, total: roster.length })}</span>
              </span>
            </button>
          </div>
        </>
      )}

      {/* reason sheet */}
      <AnimatePresence>
        {sheetIdx !== null && (
          <ReasonSheet
            player={roster[sheetIdx]}
            mark={marks[sheetIdx]}
            onApply={(minutes, cause) => {
              setMarks((prev) => {
                const next = [...prev];
                next[sheetIdx] = { ...next[sheetIdx], minutes, cause };
                return next;
              });
              setSheetIdx(null);
            }}
            onClose={() => setSheetIdx(null)}
            t={t}
          />
        )}
      </AnimatePresence>

      {/* success — online only (phase 1). Offline-confident path is phase 2. */}
      <AnimatePresence>
        {done && (
          <SuccessOverlay
            counts={counts}
            event={event}
            offline={savedOffline}
            onDone={() => router.back()}
            t={t}
          />
        )}
      </AnimatePresence>
    </main>
  );
}

function Header({
  event,
  t,
  te,
  counts,
  total,
  touched,
}: {
  event: EventMeta;
  t: ReturnType<typeof useTranslations<"attendance">>;
  te: ReturnType<typeof useTranslations<"events">>;
  counts: { present: number; late: number; absent: number };
  total: number;
  touched: number;
}) {
  const router = useRouter();
  const when = formatWhen(event.starts_at);
  return (
    <header className="pitch-band pitch-band--header px-5 pb-4 pt-6 text-white">
      <div className="relative flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label={t("back")}
          className="-m-1.5 grid h-11 w-11 flex-none place-items-center rounded-xl bg-white/[0.16] ring-1 ring-white/[0.28] backdrop-blur-sm transition-colors hover:bg-white/[0.24]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[18px] font-bold">
            {te(`type_${event.type}`)} — {event.teamName}
          </h1>
          <p className="mt-1 text-[11.5px] text-white/80">
            <span>{when.date}</span>
            <span className="mx-1.5 opacity-50">·</span>
            <span className="num">{when.time}</span>
            {event.location && (
              <>
                <span className="mx-1.5 opacity-50">·</span>
                <span>{event.location}</span>
              </>
            )}
          </p>
        </div>
        {/* live progress ring — fills as the coach marks the roster */}
        <ProgressRing done={touched} total={total} />
      </div>

      {/* live count strip */}
      <div className="relative mt-3.5 grid grid-cols-4 gap-1.5">
        <CountChip n={counts.present} label={t("stat_present")} tone="#6EE7B7" />
        <CountChip n={counts.late} label={t("stat_late")} tone="#FCD34D" />
        <CountChip n={counts.absent} label={t("stat_absent")} tone="#FCA5A5" />
        <CountChip n={total} label={t("stat_total")} tone="#FFFFFF" />
      </div>
    </header>
  );
}

function CountChip({ n, label, tone }: { n: number; label: string; tone: string }) {
  return (
    <div className="rounded-[13px] bg-white/[0.13] px-1 py-2 text-center ring-1 ring-inset ring-white/[0.18]">
      <div className="num text-[19px] font-bold leading-none" style={{ color: tone }}>{n}</div>
      <div className="mt-1 text-[9.5px] font-semibold text-white/85">{label}</div>
    </div>
  );
}

// Live completion ring — fills as the coach marks the roster (done/total).
// Pure SVG (stroke-dashoffset), no motion lib; the value change tweens via the
// CSS transition. Reduced-motion users still see the correct final fill.
function ProgressRing({ done, total }: { done: number; total: number }) {
  const r = 17;
  const circ = 2 * Math.PI * r;
  const pct = total > 0 ? done / total : 0;
  return (
    <div className="relative grid h-11 w-11 flex-none place-items-center" aria-hidden="true">
      <svg width="44" height="44" viewBox="0 0 44 44" className="-rotate-90">
        <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="3.5" />
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke="#fff"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          style={{ transition: "stroke-dashoffset .35s cubic-bezier(.32,.72,0,1)" }}
        />
      </svg>
      <span className="num absolute text-[10px] font-bold text-white">{done}</span>
    </div>
  );
}

const STATUS_ICON: Record<AttendanceStatus, string> = {
  present: "M4 12l5 5L20 6",
  late: "", // drawn as a clock below
  absent: "M6 6l12 12M18 6L6 18",
};
const STATUS_RING: Record<AttendanceStatus, string> = {
  present: "#10B981",
  late: "#F59E0B",
  absent: "#EF4444",
};
const ROW_TINT: Record<AttendanceStatus, string> = {
  present: "linear-gradient(0deg,#E7F8F0,#fff 62%)",
  late: "linear-gradient(0deg,#FEF3E2,#fff 62%)",
  absent: "linear-gradient(0deg,#FDECEA,#fff 62%)",
};
const ROW_BORDER: Record<AttendanceStatus, string> = {
  present: "#BBE9D2",
  late: "#F6DCB0",
  absent: "#F4C7C0",
};

function PlayerRow({
  player,
  mark,
  onSet,
  t,
}: {
  player: RosterPlayer;
  mark: Mark;
  onSet: (st: AttendanceStatus) => void;
  t: ReturnType<typeof useTranslations<"attendance">>;
}) {
  const reason = reasonText(mark, t);
  return (
    <div
      className="rounded-2xl border p-2.5 transition-colors"
      style={{ borderColor: ROW_BORDER[mark.status], background: ROW_TINT[mark.status] }}
    >
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-[#F4F7FB] text-[15px] font-bold text-[#51637A]">
          {player.full_name.trim().charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-[#0B1A2E]">{player.full_name}</div>
          <div className="text-[11px] text-[#5E6E80]">
            {t("jersey")}{" "}
            <span className="num">#{player.jersey_number ?? "—"}</span>
            {reason && <span className="font-semibold" style={{ color: STATUS_RING[mark.status] === "#EF4444" ? "#C0392B" : "#B45309" }}> · {reason}</span>}
          </div>
        </div>
        <div className="flex flex-none gap-1.5">
          {(["present", "late", "absent"] as AttendanceStatus[]).map((st) => {
            const on = mark.status === st;
            return (
              <button
                key={st}
                type="button"
                onClick={() => onSet(st)}
                aria-label={t(`status_${st}`)}
                aria-pressed={on}
                className="grid h-11 w-11 place-items-center rounded-xl border-[1.5px] transition-transform active:scale-90"
                style={{
                  background: on ? STATUS_RING[st] : "#fff",
                  borderColor: on ? STATUS_RING[st] : "#E3EAF1",
                }}
              >
                {st === "late" ? (
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={on ? "#fff" : "#C2CDD9"} strokeWidth="2.2" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 8v4l3 2" />
                  </svg>
                ) : (
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={on ? "#fff" : "#C2CDD9"} strokeWidth="2.4" aria-hidden="true">
                    <path d={STATUS_ICON[st]} />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ReasonSheet({
  player,
  mark,
  onApply,
  onClose,
  t,
}: {
  player: RosterPlayer;
  mark: Mark;
  onApply: (minutes: number | null, cause: string | null) => void;
  onClose: () => void;
  t: ReturnType<typeof useTranslations<"attendance">>;
}) {
  const isLate = mark.status === "late";
  const [minutes, setMinutes] = useState<number | null>(mark.minutes);
  const [cause, setCause] = useState<string | null>(mark.cause);
  const causeKeys = isLate ? CAUSES_LATE : CAUSES_ABSENT;

  return (
    <BottomSheet onClose={onClose} label={isLate ? t("reason_late_title") : t("reason_absent_title")}>
      <div className="rounded-t-[22px] bg-white px-[18px] pb-[max(18px,env(safe-area-inset-bottom))] pt-[18px]">
        <div className="mx-auto mb-3.5 h-1 w-9 rounded-full bg-[#DDE5EC]" />
        <div className="mb-3.5 flex items-center gap-2.5">
          <span
            className="grid h-[34px] w-[34px] flex-none place-items-center rounded-xl"
            style={{ background: isLate ? "#FEF3E2" : "#FDECEA" }}
          >
            {isLate ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="9" /><path d="M12 8v4l3 2" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C0392B" strokeWidth="2.2" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            )}
          </span>
          <div>
            <h3 className="text-[15px] font-bold text-[#0B1A2E]">
              {isLate ? t("reason_late_title") : t("reason_absent_title")}
            </h3>
            <div className="text-[11.5px] text-[#5E6E80]">{player.full_name}</div>
          </div>
        </div>

        {isLate && (
          <>
            <div className="mb-2 mt-1 text-[11.5px] font-semibold text-[#5E6E80]">{t("reason_minutes_label")}</div>
            <div className="flex flex-wrap gap-2">
              {MINUTES.map((m) => (
                <Chip key={m} selected={minutes === m} onClick={() => setMinutes(m)}>
                  <span className="num">{m}</span>
                </Chip>
              ))}
            </div>
          </>
        )}

        <div className="mb-2 mt-3 text-[11.5px] font-semibold text-[#5E6E80]">{t("reason_cause_label")}</div>
        <div className="flex flex-wrap gap-2">
          {causeKeys.map((c) => (
            <Chip key={c} selected={cause === c} onClick={() => setCause(c)}>
              {t(`cause_${c}`)}
            </Chip>
          ))}
        </div>

        <button
          type="button"
          onClick={() => onApply(isLate ? minutes : null, cause)}
          className="mt-4 h-12 w-full rounded-2xl text-sm font-bold text-white transition-transform active:scale-[0.98]"
          style={{ background: isLate ? "#F59E0B" : "#EF4444" }}
        >
          {isLate
            ? `${t("reason_confirm_late")}${minutes ? ` ${minutes} ${t("minutes_unit")}` : ""}`
            : t("reason_confirm_absent")}
        </button>
        <button
          type="button"
          onClick={() => onApply(null, null)}
          className="mt-2 w-full text-center text-xs text-[#5E6E80]"
        >
          {t("reason_skip")}
        </button>
      </div>
    </BottomSheet>
  );
}

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className="rounded-full border-[1.5px] px-3.5 py-2 text-[12.5px] font-semibold transition-colors"
      style={
        selected
          ? { background: "#0B1A2E", borderColor: "#0B1A2E", color: "#fff" }
          : ({ background: "#fff", borderColor: "#E3EAF1", color: "#51637A" } as CSSProperties)
      }
    >
      {children}
    </button>
  );
}

function SuccessOverlay({
  counts,
  event,
  offline,
  onDone,
  t,
}: {
  counts: { present: number; late: number; absent: number };
  event: EventMeta;
  offline: boolean;
  onDone: () => void;
  t: ReturnType<typeof useTranslations<"attendance">>;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className="fixed inset-0 z-40 flex flex-col items-center justify-center px-8 text-center"
      style={{ background: "linear-gradient(170deg,#ECFBF3 0%,#F4F8FF 100%)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={reduce ? { duration: 0 } : { duration: 0.2 }}
    >
      <SuccessCheck size={92} />
      {/* live region: SR announces the success once (the check is aria-hidden) */}
      <h2 role="status" className="mt-5 text-[21px] font-bold text-[#0B1A2E]">{t("success_title")}</h2>
      <p className="mt-1 text-[12.5px] text-[#5E6E80]">
        {event.teamName} · {formatWhen(event.starts_at).date}
      </p>

      {/* offline save was durably queued — honest "saved, will sync", no fake "synced" */}
      {offline && (
        <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-[#FEF3E2] px-3 py-1.5 text-[11.5px] font-semibold text-[#B45309]">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth="2" aria-hidden="true">
            <path d="M21 12a9 9 0 11-3-6.7L21 8" /><path d="M21 3v5h-5" />
          </svg>
          {t("success_offline")}
        </span>
      )}

      <div className="mt-6 flex gap-2.5">
        <Breakdown n={counts.present} label={t("stat_present")} bg="#E7F8F0" color="#047857" />
        <Breakdown n={counts.late} label={t("stat_late")} bg="#FEF3E2" color="#B45309" />
        <Breakdown n={counts.absent} label={t("stat_absent")} bg="#FDECEA" color="#C0392B" />
      </div>

      <button
        type="button"
        onClick={onDone}
        className="mt-7 h-12 w-full max-w-[220px] rounded-2xl bg-[#0B1A2E] text-sm font-bold text-white transition-transform active:scale-[0.98]"
      >
        {t("success_done")}
      </button>
    </motion.div>
  );
}

function Breakdown({ n, label, bg, color }: { n: number; label: string; bg: string; color: string }) {
  return (
    <div className="min-w-[64px] rounded-2xl px-1.5 py-2.5 text-center" style={{ background: bg }}>
      <div className="num text-[22px] font-bold" style={{ color }}>{n}</div>
      <div className="mt-0.5 text-[10px] font-semibold text-[#5E6E80]">{label}</div>
    </div>
  );
}

function EmptyState({ t }: { t: ReturnType<typeof useTranslations<"attendance">> }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-9 text-center">
      <h3 className="mb-2 text-lg font-bold text-[#0B1A2E]">{t("empty_title")}</h3>
      <p className="text-[13.5px] leading-relaxed text-[#5E6E80]">{t("empty_body")}</p>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
  t,
}: {
  message: string;
  onRetry: () => void;
  t: ReturnType<typeof useTranslations<"attendance">>;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-9 text-center">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#C0392B" strokeWidth="1.8" aria-hidden="true">
        <circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 16v.5" />
      </svg>
      <p className="mb-4 mt-3 text-sm font-semibold text-[#0B1A2E]">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-xl border border-[#DCE6F0] bg-white px-5 py-2.5 text-sm font-bold text-[#2563EB] transition-transform active:scale-95"
      >
        {t("retry")}
      </button>
    </div>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────────

function reasonText(mark: Mark, t: ReturnType<typeof useTranslations<"attendance">>): string {
  if (mark.status === "late" && mark.minutes) {
    return `${t("status_late")} ${mark.minutes} ${t("minutes_unit")}${mark.cause ? ` · ${t(`cause_${mark.cause}`)}` : ""}`;
  }
  if (mark.status === "absent") {
    return `${t("status_absent")}${mark.cause ? ` · ${t(`cause_${mark.cause}`)}` : ""}`;
  }
  return "";
}

// Arabic month/weekday text with WESTERN numerals (ar-u-nu-latn) — the club reads
// 2026/16:00, not ٢٠٢٦/١٦:٠٠. Numerals stay in .num spans for LTR isolation.
function formatWhen(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };
  return {
    date: d.toLocaleDateString("ar-u-nu-latn", { weekday: "long", day: "numeric", month: "long" }),
    time: d.toLocaleTimeString("ar-u-nu-latn", { hour: "2-digit", minute: "2-digit" }),
  };
}

// Track network state. Starts optimistically online (SSR has no navigator), then
// syncs to the real value + listens for online/offline events on the client.
function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}
