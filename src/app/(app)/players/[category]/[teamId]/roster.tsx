"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Player, Category } from "@/lib/players/actions";
import { positionMeta } from "@/lib/players/positions";
import { PlayerFormSheet } from "./player-form-sheet";
import { motion, AnimatePresence, useReducedMotion, EASE, SPRING } from "@/components/motion/primitives";

export function Roster({
  category,
  teamId,
  teamName,
  players,
  loadError,
}: {
  category: Category;
  teamId: string;
  teamName: string;
  players: Player[];
  loadError: string | null;
}) {
  const t = useTranslations("players");
  const router = useRouter();
  const reduce = useReducedMotion();
  const [query, setQuery] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return players;
    return players.filter((p) => {
      // Match the player's position by its LOCALIZED label (e.g. "جناح"), not the
      // raw enum value ("winger") — the coach searches in their own language.
      const meta = positionMeta(p.position);
      const posLabel = meta ? t(`pos_${meta.value}`) : "";
      return (
        p.full_name.includes(q) ||
        posLabel.includes(q) ||
        String(p.jersey_number ?? "").includes(q)
      );
    });
  }, [players, query, t]);

  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-2xl flex-col" dir="rtl">
      {/* header — the team-sheet lockup on the alive green→blue band */}
      <header className="pitch-band pitch-band--home flex items-center gap-3 px-5 pb-6 pt-7 lg:rounded-b-[28px]">
        <Link
          href={`/players/${category}`}
          aria-label={t("back")}
          className="-m-1.5 grid h-11 w-11 flex-none place-items-center rounded-xl bg-white/[0.16] text-white ring-1 ring-white/[0.28] backdrop-blur-sm transition-colors hover:bg-white/[0.24]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </Link>
        <motion.span
          aria-hidden
          className="pitch-tile grid h-[52px] w-[52px] flex-none place-items-center rounded-2xl"
          initial={reduce ? false : { scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={reduce ? { duration: 0 } : { ...SPRING, delay: 0.3 }}
        >
          <Image src="/assets/tfc-crest-circle.png" alt="" width={32} height={32} className="object-contain" />
        </motion.span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[19px] font-bold leading-tight text-white">{teamName}</h1>
          <p className="mt-0.5 text-[12px] font-medium text-white/85">{t("title")}</p>
        </div>
        {/* squad count on its own rail — the team sheet's headline number */}
        <div className="flex-none text-center">
          <div className="num text-[34px] font-bold leading-[0.85] tracking-tight text-white">{players.length}</div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-white/75">{t("count_unit")}</div>
        </div>
      </header>

      {/* search */}
      <div className="px-5 pb-1.5 pt-3">
        <div className="flex items-center gap-2 rounded-xl border border-[#E3EAF1] bg-white px-3 py-2.5 transition-colors focus-within:border-[#2563EB]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4-4" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search_placeholder")}
            aria-label={t("search_placeholder")}
            className="w-full bg-transparent text-sm text-[#0B1A2E] outline-none placeholder:text-[#94A3B8]"
          />
        </div>
      </div>

      {/* body */}
      <div className="flex-1 px-5 pb-28 pt-1.5">
        {loadError ? (
          <ErrorState message={loadError} onRetry={() => router.refresh()} t={t} />
        ) : players.length === 0 ? (
          <EmptyState t={t} onAdd={() => setSheetOpen(true)} />
        ) : filtered.length === 0 ? (
          <motion.p
            key="no-results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-12 text-center text-sm text-[#5E6E80]"
          >
            {t("no_results")}
          </motion.p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {filtered.map((p, i) => (
              <motion.li
                key={p.id}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, ease: EASE, delay: reduce ? 0 : Math.min(i * 0.04, 0.4) }}
              >
                <PlayerRow player={p} category={category} teamId={teamId} t={t} />
              </motion.li>
            ))}
          </ul>
        )}
      </div>

      {/* FAB — only when the list has loaded without error */}
      {!loadError && (
        <motion.button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-label={t("add_player")}
          className="floodlit floodlit--green fixed bottom-28 start-5 z-50 grid h-14 w-14 !rounded-full ring-1 ring-white/20 lg:bottom-6"
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={reduce ? { duration: 0.15 } : { ...SPRING, delay: 0.15 }}
          whileTap={reduce ? undefined : { scale: 0.9 }}
        >
          <svg className="relative" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </motion.button>
      )}

      <AnimatePresence>
        {sheetOpen && (
          <PlayerFormSheet
            teamId={teamId}
            teamName={teamName}
            onClose={() => setSheetOpen(false)}
            onSaved={() => {
              setSheetOpen(false);
              router.refresh();
            }}
          />
        )}
      </AnimatePresence>
    </main>
  );
}

// Neutral tile tone for a player with no position set (or a stale pre-enum value).
const POS_NEUTRAL = { color: "#2563EB", soft: "#EAF0FB", lit: "blue" as const };

function PlayerRow({
  player,
  category,
  teamId,
  t,
}: {
  player: Player;
  category: Category;
  teamId: string;
  t: ReturnType<typeof useTranslations<"players">>;
}) {
  const hasJersey = player.jersey_number != null;
  const initial = player.full_name.trim().charAt(0);
  // The 7-position meta drives the tile + chip color; the label is i18n'd from
  // the enum value. An unset/legacy position falls back to a neutral tile and
  // renders no chip (no stale string).
  const meta = positionMeta(player.position);
  const tone = meta ?? POS_NEUTRAL;
  return (
    <Link
      href={`/players/${category}/${teamId}/${player.id}`}
      className="alive-card relative flex items-center gap-3.5 overflow-hidden p-3"
    >
      {/* position-toned leading edge (RTL start) — the sheet reads by role */}
      <span aria-hidden className="absolute inset-y-0 start-0 w-[3px]" style={{ background: tone.color }} />

      {/* floodlit jersey tile — a team sheet leads with the number, lit from
          above, toned to the player's EXACT position color (all 7 distinct), so
          scanning the roster reads positions by jersey color. Unset → neutral. */}
      <span
        className={`floodlit grid h-[54px] w-[54px] flex-none ${meta ? "floodlit--pos" : "floodlit--blue"}`}
        style={meta ? ({ "--pos": meta.color } as React.CSSProperties) : undefined}
      >
        {hasJersey ? (
          <span className="num text-[25px] font-bold leading-none tracking-tight">
            {player.jersey_number}
          </span>
        ) : (
          <span className="text-[22px] font-bold leading-none">{initial}</span>
        )}
      </span>

      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-bold text-[#0B1A2E]">{player.full_name}</div>
        {meta && (
          <span
            className="mt-1 inline-flex items-center rounded-md px-1.5 py-0.5 text-[10.5px] font-bold"
            style={{ background: meta.soft, color: meta.color }}
          >
            {t(`pos_${meta.value}`)}
          </span>
        )}
      </div>

      <svg className="flex-none text-[#C2CDD9]" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M15 6l-6 6 6 6" />
      </svg>
    </Link>
  );
}

function EmptyState({
  t,
  onAdd,
}: {
  t: ReturnType<typeof useTranslations<"players">>;
  onAdd: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
      className="flex flex-col items-center justify-center px-9 pt-16 text-center"
    >
      <div className="relative mb-6 h-[120px] w-[130px]">
        <svg width="130" height="120" viewBox="0 0 130 120" fill="none" aria-hidden="true">
          <ellipse cx="65" cy="108" rx="44" ry="8" fill="#E3EAF1" />
          <rect x="22" y="40" width="86" height="52" rx="9" fill="#EAF0FB" stroke="#C7D7F0" strokeWidth="2" />
          <path d="M65 40v52M22 66h86" stroke="#C7D7F0" strokeWidth="1.5" />
          <circle cx="65" cy="66" r="11" fill="none" stroke="#C7D7F0" strokeWidth="1.5" />
        </svg>
        <div
          className="absolute right-3.5 -top-1.5"
          style={{ animation: "tfc-bob 2.6s ease-in-out infinite" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/ball.png"
            alt=""
            width={44}
            height={44}
            style={{ filter: "drop-shadow(0 5px 7px rgba(11,26,46,.22))" }}
          />
        </div>
      </div>
      <h3 className="mb-2 text-lg font-bold text-[#0B1A2E]">{t("empty_title")}</h3>
      <p className="mb-5 text-[13.5px] leading-relaxed text-[#5E6E80]">
        {t("empty_body")}
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white transition-transform active:scale-95"
        style={{ background: "#2563EB" }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        {t("add_player")}
      </button>
    </motion.div>
  );
}

function ErrorState({
  message,
  onRetry,
  t,
}: {
  message: string;
  onRetry: () => void;
  t: ReturnType<typeof useTranslations<"players">>;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE }}
      className="flex flex-col items-center justify-center px-9 pt-20 text-center"
    >
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#C0392B" strokeWidth="1.8" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v6M12 16v.5" />
      </svg>
      <p className="mb-4 mt-3 text-sm font-semibold text-[#0B1A2E]">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-xl border border-[#DCE6F0] bg-white px-5 py-2.5 text-sm font-bold text-[#2563EB] transition-transform active:scale-95"
      >
        {t("retry")}
      </button>
    </motion.div>
  );
}
