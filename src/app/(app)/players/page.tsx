import { getTranslations } from "next-intl/server";
import { teamPlayerCounts, type Category } from "@/lib/players/actions";
import { Constants } from "@/lib/supabase/types";
import { FadeUp } from "@/components/motion/primitives";
import { CategoryBoard } from "./category-board";

// /players — the team sheet. Three categories, but not three equal cards:
// Bogrim (salaried senior team) leads as a hero, the two youth rosters pair
// below. Category totals are summed from the real per-team counts
// (teamPlayerCounts — the post-teams-migration contract).
export default async function PlayersPage() {
  const t = await getTranslations("players");

  const cats = Constants.public.Enums.player_category;
  const results = await Promise.all(cats.map((c) => teamPlayerCounts(c)));

  const counts = { beet_sefer: 0, league: 0, bogrim: 0, total: 0 } as Record<
    Category | "total",
    number
  >;
  results.forEach((res, i) => {
    const sum = res.ok ? Object.values(res.data).reduce((a, b) => a + b, 0) : 0;
    counts[cats[i]] = sum;
    counts.total += sum;
  });

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pb-12 pt-8" dir="rtl">
      <FadeUp>
        <header className="mb-6">
          <h1 className="text-[26px] font-bold tracking-tight text-[#0B1A2E]">
            {t("title")}
          </h1>
          <p className="mt-1.5 text-[13px] text-[#5E6E80]">
            <span className="num">{counts.total}</span> {t("total_players")}
            <span className="mx-1.5 text-[#C2CDD9]">·</span>
            {t("categories_summary", { count: 3 })}
          </p>
        </header>
      </FadeUp>

      <CategoryBoard counts={counts} />

      {/* Why Bogrim is set apart — quiet hairline note, not a filled info box. */}
      <FadeUp delay={0.22}>
        <p className="mt-5 border-s-2 border-[#DCE9FF] ps-3.5 text-[11.5px] leading-relaxed text-[#5E6E80]">
          {t("bogrim_note")}
        </p>
      </FadeUp>
    </main>
  );
}
