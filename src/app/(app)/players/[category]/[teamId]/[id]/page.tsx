import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getPlayer, type Category } from "@/lib/players/actions";
import { Constants } from "@/lib/supabase/types";
import { ProfileActions } from "./profile-actions";
import { PlayerCard, type CardData, type Stat, type Merit } from "./player-card";
import { BackLink } from "./back-link";

const VALID = Constants.public.Enums.player_category;

function isCategory(value: string): value is Category {
  return (VALID as readonly string[]).includes(value);
}

// Whole years from an ISO birthdate. Server-rendered, so no client/server clock split.
function ageFrom(birthdate: string | null): number | null {
  if (!birthdate) return null;
  const born = new Date(birthdate);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const m = now.getMonth() - born.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < born.getDate())) age--;
  return age >= 0 && age < 120 ? age : null;
}

// ── SAMPLE performance data ───────────────────────────────────────────────
// The perf/merits backend doesn't exist yet (Atlas: design with sample data now,
// wire when Sweeper builds the schema). Numbers are derived deterministically
// from the player id so a card is stable across reloads (not random each render),
// and are age/category-aware. THIS IS THE ONLY MOCK — when the real tables land,
// replace buildStats() with the query; PlayerCard never changes.
function seedFrom(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}
// Unsigned-safe: the callers shift the seed with `>>>` (unsigned), but a seed
// above 2^31 is still a "negative" int32 to `%`, so force non-negative here.
function pick(seed: number, lo: number, hi: number): number {
  return lo + (Math.abs(seed) % (hi - lo + 1));
}

type BuiltStats = {
  rating: number;
  stars: Stat[];
  rest: Stat[];
  merits: Merit[];
};

function buildStats(
  category: Category,
  id: string,
  t: Awaited<ReturnType<typeof getTranslations<"players">>>,
): BuiltStats {
  const s = seedFrom(id);
  const num = (key: string, value: number): Stat => ({ key, label: t(`card_${key}`), value: String(value), mono: true });
  const pctStat = (key: string, value: number): Stat => ({ key, label: t(`card_${key}`), value: `${value}%`, mono: true });

  // Seniors (Bogrim) lead with goals/assists; school kids (Beet Sefer / League)
  // celebrate attendance/effort/improvement — same card, age-aware content.
  if (category === "bogrim") {
    const goals = pick(s, 4, 18);
    const assists = pick(s >>> 3, 2, 14);
    const matches = pick(s >>> 6, 12, 26);
    const rating = pick(s >>> 9, 72, 91);
    return {
      rating,
      stars: [
        num("goals", goals),
        num("assists", assists),
        num("matches", matches),
        pctStat("attendance", pick(s >>> 12, 78, 99)),
      ],
      rest: [
        num("minutes", pick(s >>> 15, 600, 2100)),
        num("cleansheets", pick(s >>> 18, 0, 9)),
        num("sessions", pick(s >>> 21, 20, 60)),
        pctStat("improvement", pick(s >>> 24, 5, 28)),
      ],
      merits: meritsFor(s, true, t),
    };
  }

  // School kids — effort/attendance forward, goals present but not the headline.
  const attendance = pick(s, 70, 100);
  const effort = pick(s >>> 3, 60, 100);
  const sessions = pick(s >>> 6, 8, 40);
  const rating = pick(s >>> 9, 68, 88);
  return {
    rating,
    stars: [
      pctStat("attendance", attendance),
      num("effort", effort),
      num("sessions", sessions),
      num("goals", pick(s >>> 12, 1, 12)),
    ],
    rest: [
      num("assists", pick(s >>> 15, 0, 10)),
      num("matches", pick(s >>> 18, 4, 18)),
      pctStat("improvement", pick(s >>> 21, 8, 35)),
      num("minutes", pick(s >>> 24, 200, 1200)),
    ],
    merits: meritsFor(s, false, t),
  };
}

// 1–3 own-pride merits (never a ranking). Pool differs by senior/school.
function meritsFor(
  s: number,
  senior: boolean,
  t: Awaited<ReturnType<typeof getTranslations<"players">>>,
): Merit[] {
  const pool = senior
    ? ["merit_hattrick", "merit_playmaker", "merit_wall", "merit_mvp"]
    : ["merit_streak", "merit_fairplay", "merit_mvp", "merit_playmaker"];
  const n = pick(s >>> 27, 1, 3);
  return pool.slice(0, n).map((k) => ({ key: k, label: t(k) }));
}

export default async function PlayerProfilePage({
  params,
}: {
  params: Promise<{ category: string; teamId: string; id: string }>;
}) {
  const { category, teamId, id } = await params;
  if (!isCategory(category)) notFound();

  const t = await getTranslations("players");
  const res = await getPlayer(id);
  if (!res.ok) notFound();
  const p = res.data;

  const age = ageFrom(p.birthdate);
  const built = buildStats(category, id, t);

  const data: CardData = {
    name: p.full_name,
    position: p.position,
    jersey: p.jersey_number,
    categoryLabel: t(`category_${category}`),
    category,
    initial: p.full_name.trim().charAt(0) || "؟",
    rating: built.rating,
    stars: built.stars,
    rest: built.rest,
    merits: built.merits,
    sample: true,
  };

  // Identity meta — the real, existing fields (calm strip under the card).
  const NS = t("not_set");
  const has = (v: string | number | null) => v != null && v !== "";
  const meta = [
    { label: t("age"), value: has(age) ? String(age) : NS, unit: has(age) ? t("age_unit") : undefined, mono: has(age) },
    { label: t("national_id"), value: p.national_id || NS, mono: has(p.national_id) },
    { label: t("height"), value: p.height_cm != null ? String(p.height_cm) : NS, unit: p.height_cm != null ? t("height_unit") : undefined, mono: p.height_cm != null },
    { label: t("guardian"), value: p.guardian_name || NS, mono: false },
  ];

  return (
    <main className="mx-auto w-full max-w-2xl pb-10" dir="rtl">
      <PlayerCard
        data={data}
        actions={
          <>
            <BackLink href={`/players/${category}/${teamId}`} label={t("back")} />
            <ProfileActions category={category} teamId={teamId} player={p} />
          </>
        }
      />

      {/* identity meta strip — real fields, demoted below the pride card */}
      <section className="px-5 pt-5">
        <h2 className="mb-3 text-[13px] font-bold text-[#0B1A2E]">{t("identity")}</h2>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {meta.map((m) => (
            <div key={m.label} className="rounded-xl bg-[#F4F7FB] px-3 py-2.5">
              <div className="mb-0.5 text-[10px] font-semibold text-[#5E6E80]">{m.label}</div>
              <div className="text-sm font-bold text-[#0B1A2E]">
                <span className={m.mono ? "num" : undefined}>{m.value}</span>
                {m.unit && <span className="text-[#51637A]"> {m.unit}</span>}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
