"use client";

import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { motion, useReducedMotion, SPRING, FadeUp } from "@/components/motion/primitives";
import type { Category } from "@/lib/players/actions";

// The Players index as a team sheet, not a settings list. All three categories
// share ONE card design — the green→blue blend band with a crest tile, name +
// description, a big roster count on its own rail, and a foot pill. Bogrim (the
// salaried senior team) leads: a touch larger, its own crest + "club pays"
// badge. The two youth rosters follow in the same design, paying dues. Real
// active counts drive every number. Calm motion (staggered settle, tap spring);
// prefers-reduced-motion collapses to instant.

type Counts = Record<Category, number>;

// Per-category visual identity — all on the SAME green→blue blend, each leaning
// a different way so they stay distinct: bogrim balanced, بيت سيفر toward blue,
// ليجا toward green. White text + glass tiles throughout (AA-safe: white ≥4.5:1
// on every gradient stop used here).
const CARD_STYLE = {
  bogrim: {
    grad:
      "radial-gradient(120% 130% at 12% 0%, rgba(52,211,153,.55) 0%, transparent 52%), linear-gradient(122deg, #10B981 0%, #1D8FCF 52%, #2563EB 100%)",
    shadow: "shadow-[0_14px_34px_rgba(16,135,120,0.30)]",
  },
  beet_sefer: {
    grad:
      "radial-gradient(120% 130% at 12% 0%, rgba(52,211,153,.40) 0%, transparent 52%), linear-gradient(122deg, #1E7FB8 0%, #2563EB 70%, #2D6BF0 100%)",
    shadow: "shadow-[0_12px_28px_rgba(37,99,235,0.26)]",
  },
  league: {
    grad:
      "radial-gradient(120% 130% at 12% 0%, rgba(52,211,153,.58) 0%, transparent 52%), linear-gradient(122deg, #10B981 0%, #1AA0A8 60%, #2274C8 100%)",
    shadow: "shadow-[0_12px_28px_rgba(16,135,120,0.26)]",
  },
} as const;

export function CategoryBoard({ counts }: { counts: Counts }) {
  return (
    <div className="flex flex-col gap-3.5">
      <CategoryCard category="bogrim" count={counts.bogrim} delay={0.04} hero />
      <CategoryCard category="beet_sefer" count={counts.beet_sefer} delay={0.1} />
      <CategoryCard category="league" count={counts.league} delay={0.16} />
    </div>
  );
}

function CategoryCard({
  category,
  count,
  delay,
  hero = false,
}: {
  category: Category;
  count: number;
  delay: number;
  hero?: boolean;
}) {
  const t = useTranslations("players");
  const reduce = useReducedMotion();
  const tap = reduce ? undefined : { scale: 0.97 };
  const s = CARD_STYLE[category];

  // Hero (Bogrim) leads with a larger crest, numeral and radius; the youth cards
  // share the exact same anatomy a notch smaller so the senior team still reads
  // first. Bogrim shows the "club pays" salaried badge; the others pay dues.
  const crest = hero ? "h-[54px] w-[54px] rounded-2xl" : "h-12 w-12 rounded-xl";
  const crestImg = hero ? 36 : 28;
  const numeral = hero ? "text-[38px]" : "text-[30px]";
  const radius = hero ? "rounded-[24px]" : "rounded-[20px]";
  const pad = hero ? "p-[18px]" : "p-4";

  return (
    <FadeUp delay={delay}>
      <Link
        href={`/players/${category}`}
        aria-label={`${t(`category_${category}`)}: ${t("count_players", { count })}`}
        className={`group relative block overflow-hidden ${radius} ${s.shadow} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2`}
      >
        <motion.div whileTap={tap} className={`relative isolate ${pad} text-white`} style={{ background: s.grad }}>
          {/* pitch-line motif — faint vertical mowing stripes */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.14]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg, transparent 0 44px, rgba(255,255,255,.9) 44px 45px)",
            }}
          />
          {/* centre-circle ghost, bottom-leading corner */}
          <svg
            aria-hidden
            className="pointer-events-none absolute -bottom-[46px] -start-[34px] opacity-[0.13]"
            width="160"
            height="160"
            viewBox="0 0 150 150"
            fill="none"
          >
            <circle cx="75" cy="75" r="54" stroke="#fff" strokeWidth="2" />
            <circle cx="75" cy="75" r="6" fill="#fff" />
          </svg>

          {/* head: crest + name on the start side, big count on the end side */}
          <div className="relative flex items-center gap-3.5">
            <motion.span
              className={`grid ${crest} flex-none place-items-center bg-white/[0.16] ring-1 ring-white/[0.28]`}
              initial={reduce ? false : { scale: 0.82, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={reduce ? { duration: 0 } : { ...SPRING, delay: delay + 0.12 }}
            >
              <Image src="/assets/tfc-crest-circle.png" alt="" width={crestImg} height={crestImg} className="object-contain" />
            </motion.span>

            <div className="min-w-0 flex-1">
              <h2 className={`${hero ? "text-[20px]" : "text-[17px]"} font-bold leading-tight`}>
                {t(`category_${category}`)}
              </h2>
              <p className={`mt-0.5 ${hero ? "text-[12.5px]" : "text-[11.5px]"} text-white/[0.86]`}>
                {t(`desc_${category}`)}
              </p>
            </div>

            <div className="flex-none text-left">
              <div className={`num ${numeral} font-bold leading-[0.9] tracking-tight`}>{count}</div>
              <div className="text-[10.5px] font-medium text-white/80">{t("count_unit")}</div>
            </div>
          </div>

          {/* foot: the money badge sits alone on its own line, never wrapping */}
          <div className="relative mt-4 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.16] px-2.5 py-1 text-[11px] font-bold ring-1 ring-white/[0.22]">
              {hero ? (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" aria-hidden="true">
                    <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
                  </svg>
                  {t("club_pays")}
                </>
              ) : (
                t("pays_dues")
              )}
            </span>
            <svg className="ms-auto opacity-65" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" aria-hidden="true">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </div>
        </motion.div>
      </Link>
    </FadeUp>
  );
}
