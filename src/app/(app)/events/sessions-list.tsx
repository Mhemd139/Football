"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createEvent, type Event, type EventType } from "@/lib/events/actions";
import type { Team, Category } from "@/lib/players/actions";
import {
  motion,
  AnimatePresence,
  useReducedMotion,
  EASE,
  SPRING,
  BottomSheet,
} from "@/components/motion/primitives";

export function SessionsList({
  sessions,
  teams,
  teamName,
  loadError,
}: {
  sessions: Event[];
  teams: Team[];
  teamName: Record<string, string>;
  loadError: string | null;
}) {
  const t = useTranslations("events");
  const router = useRouter();
  const reduce = useReducedMotion();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-2xl flex-col" dir="rtl">
      <header className="pitch-band pitch-band--home px-5 pb-7 pt-9 text-white lg:rounded-b-[28px]">
        <div className="relative flex items-center gap-3.5">
          {/* whistle/calendar mark in a glass tile — the events identity anchor */}
          <span className="grid h-[52px] w-[52px] flex-none place-items-center rounded-2xl bg-white/[0.16] ring-1 ring-white/[0.28]">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" aria-hidden="true">
              <rect x="3" y="4.5" width="18" height="16" rx="3.5" />
              <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
              <path d="M9 14l2 2 4-4" />
            </svg>
          </span>
          <div className="min-w-0">
            <h1 className="text-[22px] font-bold leading-tight">{t("title")}</h1>
            <p className="mt-0.5 text-[12.5px] text-white/85">{t("today")}</p>
          </div>
        </div>
      </header>

      <div className="flex-1 px-5 pb-28 pt-4">
        {loadError ? (
          <ErrorState message={loadError} onRetry={() => router.refresh()} t={t} />
        ) : sessions.length === 0 ? (
          <EmptyState t={t} onAdd={() => setCreateOpen(true)} />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {sessions.map((s, i) => (
              <motion.li
                key={s.id}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.26, ease: EASE, delay: reduce ? 0 : Math.min(i * 0.05, 0.3) }}
              >
                <SessionRow session={s} teamName={teamName[s.team_id] ?? ""} t={t} />
              </motion.li>
            ))}
          </ul>
        )}
      </div>

      {/* create FAB — primary green action, alive with a colored shadow + sheen */}
      <motion.button
        type="button"
        onClick={() => setCreateOpen(true)}
        aria-label={t("add")}
        className="fixed bottom-28 start-5 z-50 grid h-14 w-14 place-items-center rounded-full text-white shadow-[0_12px_28px_rgba(4,120,87,0.45)] ring-1 ring-white/20 lg:bottom-6"
        style={{ background: "linear-gradient(140deg,#10B981,#047857)" }}
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={reduce ? { duration: 0.15 } : { ...SPRING, delay: 0.15 }}
        whileTap={reduce ? undefined : { scale: 0.9 }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </motion.button>

      <AnimatePresence>
        {createOpen && (
          <CreateSessionSheet
            teams={teams}
            onClose={() => setCreateOpen(false)}
            onCreated={(ev) => {
              setCreateOpen(false);
              // straight into taking attendance for the session just made
              router.push(`/events/${ev.id}/attendance`);
            }}
          />
        )}
      </AnimatePresence>
    </main>
  );
}

function SessionRow({
  session,
  teamName,
  t,
}: {
  session: Event;
  teamName: string;
  t: ReturnType<typeof useTranslations<"events">>;
}) {
  const when = formatTime(session.starts_at);
  const isMatch = session.type === "match";
  // Type leans the row's accent the same way the app blend does: match → blue,
  // training → green. A vivid gradient tile + a matching colored shadow give the
  // card depth so it reads alive, not like a flat list item.
  const tileGrad = isMatch
    ? "linear-gradient(140deg,#2563EB,#1E40AF)"
    : "linear-gradient(140deg,#10B981,#047857)";
  const shadow = isMatch
    ? "shadow-[0_6px_18px_rgba(37,99,235,0.16)]"
    : "shadow-[0_6px_18px_rgba(16,135,120,0.16)]";
  return (
    <Link
      href={`/events/${session.id}/attendance`}
      className={`group flex items-center gap-3 rounded-2xl border border-[#EAF0F7] bg-white p-3.5 ${shadow} transition-all hover:-translate-y-0.5 hover:border-[#D7E3F2] active:scale-[0.99]`}
    >
      <span
        className="grid h-12 w-12 flex-none place-items-center rounded-2xl text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]"
        style={{ background: tileGrad }}
      >
        {isMatch ? (
          // match → football (the real-world match object)
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" aria-hidden="true">
            <circle cx="12" cy="12" r="9" /><path d="M12 3a9 9 0 000 18M3 12h18" />
          </svg>
        ) : (
          // training → coach's whistle (literal: a training session)
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" aria-hidden="true">
            <circle cx="11" cy="14" r="6" />
            <path d="M11 11.5v2.5h2.5M17 9l4-3M15.5 7.5l1.5-3.5" strokeLinecap="round" />
          </svg>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex flex-none items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold"
            style={{
              background: isMatch ? "#EAF0FB" : "#E7F8F0",
              color: isMatch ? "#1E40AF" : "#047857",
            }}
          >
            {t(`type_${session.type}`)}
          </span>
          <span className="truncate text-sm font-bold text-[#0B1A2E]">{session.title}</span>
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-[11.5px] text-[#5E6E80]">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#5E6E80" strokeWidth="2" aria-hidden="true" className="flex-none">
            <circle cx="12" cy="12" r="9" /><path d="M12 8v4l3 2" />
          </svg>
          <span className="num flex-none font-semibold text-[#0B1A2E]">{when}</span>
          {teamName && (
            <>
              <span className="flex-none text-[#C2CDD9]">·</span>
              <span className="truncate">{teamName}</span>
            </>
          )}
        </div>
      </div>
      <span className="flex flex-none items-center gap-1 rounded-full bg-[#E7F8F0] px-2.5 py-1.5 text-[10.5px] font-bold text-[#047857] transition-colors group-hover:bg-[#D6F2E4]">
        {t("take_attendance")}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#047857" strokeWidth="2.4" aria-hidden="true">
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </span>
    </Link>
  );
}

function CreateSessionSheet({
  teams,
  onClose,
  onCreated,
}: {
  teams: Team[];
  onClose: () => void;
  onCreated: (ev: Event) => void;
}) {
  const t = useTranslations("events");
  const [title, setTitle] = useState("");
  const [type, setType] = useState<EventType>("training");
  const [teamId, setTeamId] = useState<string>(teams[0]?.id ?? "");
  const [datetime, setDatetime] = useState(() => defaultLocalDatetime());
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = title.trim().length > 0 && teamId.length > 0 && datetime.length > 0;

  async function onSubmit() {
    if (!canSave || saving) return;
    setSaving(true);
    setError(null);
    const starts_at = new Date(datetime).toISOString();
    const res = await createEvent({
      team_id: teamId,
      title: title.trim(),
      type,
      starts_at,
      location: location.trim() || null,
    });
    setSaving(false);
    if (!res.ok) {
      setError(t(res.error.startsWith("events.") ? res.error.slice(7) : "save_failed"));
      return;
    }
    onCreated(res.data);
  }

  return (
    <BottomSheet onClose={onClose} label={t("create_title")}>
      <div className="rounded-t-[22px] bg-white px-[18px] pb-[max(18px,env(safe-area-inset-bottom))] pt-[18px]">
        <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-[#DDE5EC]" />
        <h3 className="mb-4 text-[16px] font-bold text-[#0B1A2E]">{t("create_title")}</h3>

        <Field label={t("field_title")}>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("field_title_placeholder")}
            className="w-full rounded-xl border border-[#E3EAF1] bg-white px-3 py-2.5 text-sm text-[#0B1A2E] outline-none transition-colors focus:border-[#2563EB] placeholder:text-[#94A3B8]"
          />
        </Field>

        <Field label={t("field_type")}>
          <div className="flex gap-2">
            {(["training", "match"] as EventType[]).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setType(opt)}
                aria-pressed={type === opt}
                className="flex-1 rounded-xl border-[1.5px] py-2.5 text-sm font-semibold transition-colors"
                style={
                  type === opt
                    ? { background: "#0B1A2E", borderColor: "#0B1A2E", color: "#fff" }
                    : { background: "#fff", borderColor: "#E3EAF1", color: "#51637A" }
                }
              >
                {t(`type_${opt}`)}
              </button>
            ))}
          </div>
        </Field>

        <Field label={t("field_team")}>
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            className="w-full rounded-xl border border-[#E3EAF1] bg-white px-3 py-2.5 text-sm text-[#0B1A2E] outline-none transition-colors focus:border-[#2563EB]"
          >
            {teams.length === 0 && <option value="">{t("field_team_placeholder")}</option>}
            {teams.map((tm) => (
              <option key={tm.id} value={tm.id}>
                {teamLabel(tm)}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t("field_datetime")}>
          <input
            type="datetime-local"
            value={datetime}
            onChange={(e) => setDatetime(e.target.value)}
            className="num w-full rounded-xl border border-[#E3EAF1] bg-white px-3 py-2.5 text-sm text-[#0B1A2E] outline-none transition-colors focus:border-[#2563EB]"
          />
        </Field>

        <Field label={t("field_location")}>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder={t("field_location_placeholder")}
            className="w-full rounded-xl border border-[#E3EAF1] bg-white px-3 py-2.5 text-sm text-[#0B1A2E] outline-none transition-colors focus:border-[#2563EB] placeholder:text-[#94A3B8]"
          />
        </Field>

        {error && (
          <p role="alert" className="mt-1 text-center text-xs font-semibold text-[#C0392B]">{error}</p>
        )}

        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSave || saving}
          className="mt-4 h-12 w-full rounded-2xl text-sm font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-60"
          style={{ background: "#047857" }}
        >
          {saving ? t("saving") : t("save")}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 w-full text-center text-xs text-[#5E6E80]"
        >
          {t("cancel")}
        </button>
      </div>
    </BottomSheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1.5 block text-[11.5px] font-semibold text-[#5E6E80]">{label}</span>
      {children}
    </label>
  );
}

function EmptyState({
  t,
  onAdd,
}: {
  t: ReturnType<typeof useTranslations<"events">>;
  onAdd: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-9 pt-16 text-center">
      <div className="relative mb-6 h-[120px] w-[130px]">
        <svg width="130" height="120" viewBox="0 0 130 120" fill="none" aria-hidden="true">
          <ellipse cx="65" cy="108" rx="44" ry="8" fill="#E3EAF1" />
          <rect x="22" y="34" width="86" height="58" rx="9" fill="#EAF0FB" stroke="#C7D7F0" strokeWidth="2" />
          <path d="M22 50h86M44 28v12M86 28v12" stroke="#C7D7F0" strokeWidth="1.5" />
        </svg>
        <div className="absolute -top-1.5 right-3.5" style={{ animation: "tfc-bob 2.6s ease-in-out infinite" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/ball.png" alt="" width={44} height={44} style={{ filter: "drop-shadow(0 5px 7px rgba(11,26,46,.22))" }} />
        </div>
      </div>
      <h3 className="mb-2 text-lg font-bold text-[#0B1A2E]">{t("empty_title")}</h3>
      <p className="mb-5 text-[13.5px] leading-relaxed text-[#5E6E80]">{t("empty_body")}</p>
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-bold text-white shadow-[0_10px_24px_rgba(4,120,87,0.32)] ring-1 ring-white/20 transition-transform active:scale-95"
        style={{ background: "linear-gradient(140deg,#10B981,#047857)" }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        {t("add")}
      </button>
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
  t: ReturnType<typeof useTranslations<"events">>;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-9 pt-20 text-center">
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

function teamLabel(team: Team): string {
  // category prefix helps disambiguate same-named teams across categories
  const cat: Record<Category, string> = {
    beet_sefer: "بيت سيفر",
    league: "ليجا",
    bogrim: "بوجريم",
  };
  return `${team.name} · ${cat[team.category]}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // Western numerals in the Arabic UI (ar-u-nu-latn) — the club reads 16:00, not ١٦:٠٠.
  return d.toLocaleTimeString("ar-u-nu-latn", { hour: "2-digit", minute: "2-digit" });
}

// datetime-local wants "YYYY-MM-DDTHH:mm" in LOCAL time. Default to the next
// round hour today, so the coach mostly just confirms.
function defaultLocalDatetime(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
