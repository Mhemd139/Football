"use client";

import { useTranslations } from "next-intl";
import { motion, useReducedMotion, SPRING } from "@/components/motion/primitives";
import type { Category } from "@/lib/players/actions";
import { positionMeta } from "@/lib/players/positions";

// The player's pride card — downscoped to the SIMPLE version (Atlas ruling, owner
// 2026-06-27): "a card that highlights who the person is, with the goals — the most
// basic and simple version." Identity hero + one goals focal block. No rating ring,
// no stat dashboard, no merits, no sample data. The full gamified performance card
// is parked as M-perf / paid Phase 2.
//
// Goals have no backend yet (no logging path exists), so the goals block renders an
// honest "coming soon" state until Sweeper lands a goals source — one real card,
// never a fake number.

export type CardData = {
  name: string;
  position: string | null;
  jersey: number | null;
  categoryLabel: string;
  category: Category;
  initial: string;
  age: number | null;
  goals: number | null; // null = no backend yet → honest "coming soon"
  attendance: number | null; // real % when Sweeper lands the aggregate; null → "coming soon"
};

export function PlayerCard({ data, actions }: { data: CardData; actions: React.ReactNode }) {
  const t = useTranslations("players");
  const reduce = useReducedMotion();
  // Position drives the floodlit tile tone + the chip; the label is i18n'd from
  // the enum value, mirroring the roster's positional read. Unset/legacy → blue.
  const meta = positionMeta(data.position);
  const tone = meta?.lit ?? "blue";

  return (
    <>
      {/* ===== HERO — alive green→blue band, built to be screenshotted ===== */}
      <header className="pitch-band pitch-band--home px-5 pb-6 pt-7 lg:rounded-b-[28px]">
        <div className="flex items-center justify-between">
          {actions}
        </div>

        <div className="mt-4 flex items-center gap-4">
          {/* floodlit jersey tile — the hero object, toned by the player's EXACT
              position color (all 7 distinct); unset → neutral blue. */}
          <motion.span
            aria-hidden
            className={`floodlit relative h-[78px] w-[78px] flex-none rounded-[22px] ${meta ? "floodlit--pos" : "floodlit--blue"}`}
            style={meta ? ({ "--pos": meta.color } as React.CSSProperties) : undefined}
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
              {meta && <Chip>{t(`pos_${meta.value}`)}</Chip>}
              <Chip>{data.categoryLabel}</Chip>
              {data.age != null && (
                <Chip>
                  <span className="num">{data.age}</span> {t("age_unit")}
                </Chip>
              )}
            </div>
          </div>
        </div>

        {/* one warm, club-voiced motivational line (brand voice, not a score) */}
        <p className="mt-4 text-[12.5px] font-medium italic text-white/85">“{t("card_motto")}”</p>
      </header>

      {/* ===== FOCAL STATS — goals (the owner's ask) + real attendance ===== */}
      <section className="grid grid-cols-1 gap-2.5 px-5 pt-4 sm:grid-cols-2">
        <StatBlock
          value={data.goals}
          label={t("card_goals_label")}
          soon={t("card_goals_soon")}
          icon={<BallIcon />}
          tone={tone}
        />
        <StatBlock
          value={data.attendance != null ? `${data.attendance}%` : null}
          label={t("card_attendance_label")}
          soon={t("card_attendance_soon")}
          icon={<CheckIcon />}
          tone="green"
        />
      </section>
    </>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-white/[0.18] px-2.5 py-0.5 text-[11px] font-bold text-white ring-1 ring-white/[0.24]">
      {children}
    </span>
  );
}

// A focal stat block. A real value when the backend exists; an honest "coming
// soon" state until then — never a placeholder zero that reads as fact.
// STATIC (no motion) on purpose: a Framer `transform` promotes the card to its
// own paint layer that renders ABOVE the fixed edit sheet (the tiles bled over
// the modal). A plain div sits on the page's own layer, so the modal covers it.
function StatBlock({
  value,
  label,
  soon,
  icon,
  tone,
}: {
  value: number | string | null;
  label: string;
  soon: string;
  icon: React.ReactNode;
  tone: "gold" | "blue" | "green" | "red";
}) {
  return (
    <div className="alive-card flex items-center gap-4 p-4">
      <span aria-hidden className={`floodlit floodlit--${tone} h-[56px] w-[56px] flex-none rounded-2xl`}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-bold text-[#5E6E80]">{label}</div>
        {value != null ? (
          <div className="num text-[30px] font-bold leading-none text-[#0B1A2E]">{value}</div>
        ) : (
          <div className="mt-0.5 inline-flex items-center gap-1.5 rounded-full bg-[#EAF0FB] px-2.5 py-1 text-[11px] font-bold text-[#2455C4]">
            {soon}
          </div>
        )}
      </div>
    </div>
  );
}

function BallIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" className="drop-shadow-[0_1px_1px_rgba(11,26,46,0.25)]" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.5 6.5l2.8 2.8M14.7 14.7l2.8 2.8M17.5 6.5l-2.8 2.8M9.3 14.7l-2.8 2.8" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" className="drop-shadow-[0_1px_1px_rgba(11,26,46,0.25)]" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
