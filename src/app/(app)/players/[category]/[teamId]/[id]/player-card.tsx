"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { motion, useReducedMotion, EASE, SPRING } from "@/components/motion/primitives";
import type { Category } from "@/lib/players/actions";

// The player's pride card — the ONE gamified surface (Atlas ruling, owner
// override 2026-06-27). Own-pride only, NO inter-kid ranking. Hero surfaces the
// few star numbers; the long tail lives behind a "full stats" expand. Stats are
// SAMPLE data today (no perf backend yet — Atlas authorized sample-data design);
// every number flows through the `stats` prop so it swaps to real data untouched.

export type Stat = { key: string; label: string; value: string; mono: boolean };
export type Merit = { key: string; label: string };

export type CardData = {
  name: string;
  position: string | null;
  jersey: number | null;
  categoryLabel: string;
  category: Category;
  initial: string;
  rating: number; // the champion number (sample)
  stars: Stat[]; // 4 hero stats
  rest: Stat[]; // the long tail (full-stats expand)
  merits: Merit[];
  sample: boolean;
};

// Position → floodlit tone, mirrors the roster's positional read.
function toneOf(position: string | null): "gold" | "blue" | "green" | "red" {
  if (!position) return "blue";
  const p = position.toLowerCase();
  const has = (...xs: string[]) => xs.some((x) => p.includes(x));
  if (has("حارس", "goal", "gk", "שוער")) return "gold";
  if (has("دفاع", "مدافع", "def", "back", "הגנה")) return "blue";
  if (has("وسط", "mid", "קישור")) return "green";
  if (has("مهاجم", "هجوم", "att", "forward", "striker", "חלוץ")) return "red";
  return "blue";
}

export function PlayerCard({ data, actions }: { data: CardData; actions: React.ReactNode }) {
  const t = useTranslations("players");
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const tone = toneOf(data.position);

  return (
    <>
      {/* ===== HERO — alive green→blue band, built to be screenshotted ===== */}
      <header className="pitch-band pitch-band--home px-5 pb-6 pt-7 lg:rounded-b-[28px]">
        <div className="flex items-center justify-between">
          {actions}
        </div>

        <div className="mt-4 flex items-center gap-4">
          {/* floodlit jersey tile — the hero object, toned by position */}
          <motion.span
            aria-hidden
            className={`floodlit floodlit--${tone} relative h-[78px] w-[78px] flex-none rounded-[22px]`}
            initial={reduce ? false : { scale: 0.82, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={reduce ? { duration: 0 } : { ...SPRING, delay: 0.1 }}
          >
            {data.jersey != null ? (
              <span className="num text-[34px] font-bold leading-none drop-shadow-[0_2px_3px_rgba(11,26,46,0.3)]">
                {data.jersey}
              </span>
            ) : (
              <span className="text-[32px] font-bold drop-shadow-[0_2px_3px_rgba(11,26,46,0.3)]">{data.initial}</span>
            )}
          </motion.span>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[22px] font-bold leading-tight text-white">{data.name}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {data.position && (
                <span className="rounded-full bg-white/[0.18] px-2.5 py-0.5 text-[11px] font-bold text-white ring-1 ring-white/[0.24]">
                  {data.position}
                </span>
              )}
              <span className="rounded-full bg-white/[0.18] px-2.5 py-0.5 text-[11px] font-bold text-white ring-1 ring-white/[0.24]">
                {data.categoryLabel}
              </span>
            </div>
          </div>

          {/* the champion number — overall rating ring */}
          <RatingRing value={data.rating} label={t("card_rating")} reduce={reduce} />
        </div>

        {/* one warm, club-voiced motivational line (brand voice, not a score) */}
        <p className="mt-4 text-[12.5px] font-medium italic text-white/85">“{t("card_motto")}”</p>
      </header>

      {/* ===== STAR STATS — the few proud numbers ===== */}
      <section className="px-5 pt-4">
        <div className="mb-2.5 flex items-baseline justify-between">
          <h2 className="text-[13px] font-bold text-[#0B1A2E]">{t("card_season")}</h2>
          {data.sample && (
            <span className="text-[10px] font-semibold text-[#9AA9B8]">{t("card_sample_note")}</span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {data.stars.map((s, i) => (
            <motion.div
              key={s.key}
              className="alive-card flex flex-col items-center gap-1 p-3.5 text-center"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: EASE, delay: reduce ? 0 : 0.06 + i * 0.05 }}
            >
              <span className={`text-[26px] font-bold leading-none text-[#0B1A2E] ${s.mono ? "num" : ""}`}>
                {s.value}
              </span>
              <span className="text-[10.5px] font-semibold text-[#5E6E80]">{s.label}</span>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ===== MERITS — earned badges, own-pride (no ranking) ===== */}
      {data.merits.length > 0 && (
        <section className="px-5 pt-4">
          <h2 className="mb-2.5 text-[13px] font-bold text-[#0B1A2E]">{t("card_merits")}</h2>
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {data.merits.map((m) => (
              <span
                key={m.key}
                className="floodlit floodlit--gold flex flex-none items-center gap-1.5 rounded-full px-3.5 py-2 text-[12px] font-bold"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="8" r="5" />
                  <path d="M8.5 12.5L7 21l5-3 5 3-1.5-8.5" />
                </svg>
                {m.label}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* ===== FULL STATS — the long tail, behind an expand ===== */}
      <section className="px-5 pt-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center justify-between rounded-2xl border border-[#E3EAF1] bg-white px-4 py-3 text-start transition active:scale-[0.99]"
        >
          <span className="text-[13px] font-bold text-[#0B1A2E]">
            {open ? t("card_hide_stats") : t("card_full_stats")}
          </span>
          <motion.svg
            width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7C8BA1" strokeWidth="2" aria-hidden="true"
            animate={{ rotate: open ? 180 : 0 }}
            transition={reduce ? { duration: 0 } : { duration: 0.2, ease: EASE }}
          >
            <path d="M6 9l6 6 6-6" />
          </motion.svg>
        </button>

        <AnimatedPanel open={open} reduce={!!reduce}>
          <div className="grid grid-cols-2 gap-2.5 pt-2.5 sm:grid-cols-3">
            {data.rest.map((s) => (
              <div key={s.key} className="rounded-xl bg-[#F4F7FB] px-3 py-2.5">
                <div className="mb-0.5 text-[10px] font-semibold text-[#5E6E80]">{s.label}</div>
                <div className={`text-[15px] font-bold text-[#0B1A2E] ${s.mono ? "num" : ""}`}>{s.value}</div>
              </div>
            ))}
          </div>
        </AnimatedPanel>
      </section>
    </>
  );
}

// The overall-rating ring — the screenshot's champion number.
function RatingRing({ value, label, reduce }: { value: number; label: string; reduce: boolean | null }) {
  const pct = Math.max(0, Math.min(100, value)) / 100;
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid h-[64px] w-[64px] flex-none place-items-center">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="5" />
        <motion.circle
          cx="32" cy="32" r={r} fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round"
          strokeDasharray={c}
          initial={reduce ? { strokeDashoffset: c * (1 - pct) } : { strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={reduce ? { duration: 0 } : { duration: 0.9, ease: EASE, delay: 0.2 }}
        />
      </svg>
      <div className="text-center leading-none">
        <div className="num text-[20px] font-bold text-white">{value}</div>
        <div className="text-[8px] font-semibold uppercase tracking-wide text-white/75">{label}</div>
      </div>
    </div>
  );
}

// Height-animated expand (grid-rows trick → animates from 0 to content height).
function AnimatedPanel({ open, reduce, children }: { open: boolean; reduce: boolean; children: React.ReactNode }) {
  return (
    <motion.div
      initial={false}
      animate={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      transition={reduce ? { duration: 0 } : { duration: 0.26, ease: EASE }}
      className="grid"
      style={{ display: "grid" }}
    >
      <div className="overflow-hidden">{children}</div>
    </motion.div>
  );
}
