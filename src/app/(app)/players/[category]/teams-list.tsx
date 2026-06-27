"use client";

import { useState, useTransition, type CSSProperties, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createTeam, type Category, type Team } from "@/lib/players/actions";
import {
  BottomSheet,
  motion,
  AnimatePresence,
  useReducedMotion,
  EASE,
  SPRING,
} from "@/components/motion/primitives";

export function TeamsList({
  category,
  teams,
  counts,
  loadError,
}: {
  category: Category;
  teams: Team[];
  counts: Record<string, number>;
  loadError: string | null;
}) {
  const t = useTranslations("teams");
  const tp = useTranslations("players");
  const router = useRouter();
  const reduce = useReducedMotion();
  const [sheetOpen, setSheetOpen] = useState(false);

  const categoryName = tp(`category_${category}`);

  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-2xl flex-col" dir="rtl">
      <header className="pitch-band pitch-band--home flex items-center gap-3 px-5 pb-6 pt-7 lg:rounded-b-[28px]">
        <Link
          href="/players"
          aria-label={tp("back")}
          className="-m-1.5 grid h-11 w-11 flex-none place-items-center rounded-xl bg-white/[0.16] text-white ring-1 ring-white/[0.28] backdrop-blur-sm transition-colors hover:bg-white/[0.24]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
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
          <h1 className="truncate text-[19px] font-bold leading-tight text-white">{categoryName}</h1>
          <p className="mt-0.5 text-[12px] font-medium text-white/85">{tp("count_players", { count: counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0 })}</p>
        </div>
        <div className="flex-none text-center">
          <div className="num text-[34px] font-bold leading-[0.85] tracking-tight text-white">{teams.length}</div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-white/75">{t("title")}</div>
        </div>
      </header>

      <div className="flex-1 px-5 pb-28 pt-3.5">
        {loadError ? (
          <ErrorState message={loadError} onRetry={() => router.refresh()} retry={tp("retry")} />
        ) : teams.length === 0 ? (
          <EmptyState t={t} onAdd={() => setSheetOpen(true)} />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {teams.map((team, i) => (
              <motion.li
                key={team.id}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, ease: EASE, delay: reduce ? 0 : Math.min(i * 0.04, 0.4) }}
              >
                <TeamRow team={team} count={counts[team.id] ?? 0} unit={tp("count_unit")} />
              </motion.li>
            ))}
          </ul>
        )}
      </div>

      {!loadError && (
        <motion.button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-label={t("add")}
          className="fixed bottom-28 start-5 z-50 grid h-12 w-12 place-items-center rounded-full text-white shadow-[0_10px_24px_rgba(37,99,235,0.4)] lg:bottom-6"
          style={{ background: "#2563EB" }}
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={reduce ? { duration: 0.15 } : { ...SPRING, delay: 0.15 }}
          whileTap={reduce ? undefined : { scale: 0.9 }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </motion.button>
      )}

      <AnimatePresence>
        {sheetOpen && (
          <CreateTeamSheet
            category={category}
            categoryName={categoryName}
            onClose={() => setSheetOpen(false)}
            onCreated={() => {
              setSheetOpen(false);
              router.refresh();
            }}
          />
        )}
      </AnimatePresence>
    </main>
  );
}

function TeamRow({ team, count, unit }: { team: Team; count: number; unit: string }) {
  return (
    <Link
      href={`/players/${team.category}/${team.id}`}
      className="alive-card relative flex items-center gap-3.5 overflow-hidden p-3.5"
    >
      {/* status spine (RTL start) */}
      <span aria-hidden className="absolute inset-y-0 start-0 w-[3px]" style={{ background: "#2563EB" }} />
      <span aria-hidden className="floodlit floodlit--blue h-[52px] w-[52px] flex-none rounded-2xl">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" className="drop-shadow-[0_1px_1px_rgba(11,26,46,0.25)]">
          <path d="M17 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2" />
          <circle cx="10" cy="7" r="4" />
          <path d="M21 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-bold tracking-tight text-[#0B1A2E]">{team.name}</div>
        <div className="num mt-0.5 text-[11.5px] text-[#5E6E80]">
          {count} {unit}
        </div>
      </div>
      <svg className="flex-none text-[#C2CDD9]" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M15 6l-6 6 6 6" />
      </svg>
    </Link>
  );
}

function CreateTeamSheet({
  category,
  categoryName,
  onClose,
  onCreated,
}: {
  category: Category;
  categoryName: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const t = useTranslations("teams");
  const cancel = useTranslations("players")("cancel");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const title = t("create_title", { category: categoryName });

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const name = String(new FormData(e.currentTarget).get("name") ?? "").trim();
    if (!name) {
      setError(t("invalid_name"));
      return;
    }
    startTransition(async () => {
      const res = await createTeam(category, name);
      if (!res.ok) {
        setError(t(res.error));
        return;
      }
      onCreated();
    });
  }

  return (
    <BottomSheet onClose={onClose} label={title}>
      <div
        dir="rtl"
        className="mx-auto w-full max-w-md rounded-t-[26px] bg-white px-6 pb-7 pt-2.5"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#D5DEE8]" />
        <h2 className="mb-5 text-[17px] font-bold text-[#0B1A2E]">{title}</h2>
        <form onSubmit={submit} noValidate className="flex flex-col gap-3.5">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[#51637A]">
              {t("name_label")}
              <span className="text-[var(--color-chrome)]"> *</span>
            </span>
            <input
              name="name"
              autoFocus
              placeholder={t("name_placeholder")}
              className="w-full rounded-xl border-[1.5px] border-[#DCE6F0] bg-[#F4F7FB] px-3.5 py-3 text-[15px] text-[#0B1A2E] outline-none placeholder:text-[#94A3B8] focus:border-[var(--color-chrome)]"
            />
          </label>

          {error && (
            <div role="alert" className="text-[13px] font-semibold text-[#C0392B]">
              {error}
            </div>
          )}

          <div className="mt-1 flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="flex-1 rounded-xl border border-[#DCE6F0] bg-white py-3.5 text-sm font-bold text-[#0B1A2E]"
            >
              {cancel}
            </button>
            <button
              type="submit"
              disabled={pending}
              className="flex-1 rounded-xl py-3.5 text-sm font-bold text-white shadow-[0_10px_24px_rgba(37,99,235,0.28)] disabled:opacity-70"
              style={{ background: "#2563EB" }}
            >
              {pending ? t("saving") : t("save")}
            </button>
          </div>
        </form>
      </div>
    </BottomSheet>
  );
}

function EmptyState({
  t,
  onAdd,
}: {
  t: ReturnType<typeof useTranslations<"teams">>;
  onAdd: () => void;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.28, ease: EASE }}
      className="flex flex-col items-center justify-center px-9 pt-16 text-center"
    >
      <div
        className="mb-6 grid h-[110px] w-[110px] place-items-center rounded-3xl ring-1"
        style={{ background: "#E8F0FD", "--tw-ring-color": "#D3E1F7" } as CSSProperties}
      >
        <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#1E50C8" strokeWidth="1.4" aria-hidden="true">
          <path d="M17 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2" />
          <circle cx="10" cy="7" r="4" />
          <path d="M21 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
        </svg>
      </div>
      <h3 className="mb-2 text-lg font-bold text-[#0B1A2E]">{t("empty_title")}</h3>
      <p className="mb-5 text-[13.5px] leading-relaxed text-[#5E6E80]">{t("empty_body")}</p>
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white transition-transform active:scale-95"
        style={{ background: "#2563EB" }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        {t("add")}
      </button>
    </motion.div>
  );
}

function ErrorState({
  message,
  onRetry,
  retry,
}: {
  message: string;
  onRetry: () => void;
  retry: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.28, ease: EASE }}
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
        {retry}
      </button>
    </motion.div>
  );
}
