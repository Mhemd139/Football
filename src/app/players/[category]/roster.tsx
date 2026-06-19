"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Player, Category } from "@/lib/players/actions";
import { PlayerFormSheet } from "./player-form-sheet";

export function Roster({
  category,
  players,
  loadError,
}: {
  category: Category;
  players: Player[];
  loadError: string | null;
}) {
  const t = useTranslations("players");
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return players;
    return players.filter(
      (p) =>
        p.full_name.includes(q) ||
        (p.position?.includes(q) ?? false) ||
        String(p.jersey_number ?? "").includes(q),
    );
  }, [players, query]);

  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-2xl flex-col" dir="rtl">
      {/* header */}
      <header className="flex items-center gap-2.5 border-b border-[#EEF2F6] bg-white px-5 pb-3.5 pt-6">
        <Link
          href="/players"
          aria-label={t("back")}
          className="grid h-8 w-8 place-items-center rounded-lg text-[#0B1A2E] hover:bg-[#F4F7FB]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </Link>
        <div>
          <h1 className="text-base font-bold text-[#0B1A2E]">
            {t(`category_${category}`)}
          </h1>
          <p className="num text-[11px] text-[#6B7A8D]">
            {t("count_players", { count: players.length })}
          </p>
        </div>
      </header>

      {/* search */}
      <div className="px-5 pb-1.5 pt-3">
        <div className="flex items-center gap-2 rounded-xl border border-[#E3EAF1] bg-white px-3 py-2.5">
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
          <p className="py-12 text-center text-sm text-[#6B7A8D]">
            {t("no_results")}
          </p>
        ) : (
          <ul>
            {filtered.map((p) => (
              <PlayerRow key={p.id} player={p} category={category} />
            ))}
          </ul>
        )}
      </div>

      {/* FAB — only when the list has loaded without error */}
      {!loadError && (
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-label={t("add_player")}
          className="fixed bottom-6 left-5 grid h-12 w-12 place-items-center rounded-full text-white shadow-[0_10px_24px_rgba(37,99,235,0.4)]"
          style={{ background: "#2563EB" }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      )}

      {sheetOpen && (
        <PlayerFormSheet
          category={category}
          onClose={() => setSheetOpen(false)}
          onSaved={() => {
            setSheetOpen(false);
            router.refresh();
          }}
        />
      )}
    </main>
  );
}

function PlayerRow({ player, category }: { player: Player; category: Category }) {
  const initial = player.full_name.trim().charAt(0);
  const meta = [player.position, player.jersey_number != null ? `#${player.jersey_number}` : null]
    .filter(Boolean)
    .join(" · ");
  return (
    <li>
      <Link
        href={`/players/${category}/${player.id}`}
        className="flex items-center gap-3 border-b border-[#EEF2F6] px-1 py-2.5 transition hover:bg-[#F4F7FB]"
      >
        <div className="grid h-9 w-9 flex-none place-items-center rounded-full bg-[#EAF0FB] text-sm font-bold text-[#2563EB]">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-[#0B1A2E]">
            {player.full_name}
          </div>
          {meta && <div className="num text-[11px] text-[#6B7A8D]">{meta}</div>}
        </div>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#C2CDD9" strokeWidth="2" aria-hidden="true">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </Link>
    </li>
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
    <div className="flex flex-col items-center justify-center px-9 pt-16 text-center">
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
      <p className="mb-5 text-[13.5px] leading-relaxed text-[#6B7A8D]">
        {t("empty_body")}
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white"
        style={{ background: "#2563EB" }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        {t("add_player")}
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
  t: ReturnType<typeof useTranslations<"players">>;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-9 pt-20 text-center">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#C0392B" strokeWidth="1.8" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v6M12 16v.5" />
      </svg>
      <p className="mb-4 mt-3 text-sm font-semibold text-[#0B1A2E]">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-xl border border-[#DCE6F0] bg-white px-5 py-2.5 text-sm font-bold text-[#2563EB]"
      >
        {t("retry")}
      </button>
    </div>
  );
}
