import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getPlayer, type Category } from "@/lib/players/actions";
import { Constants } from "@/lib/supabase/types";
import { ProfileActions } from "./profile-actions";
import { PlayerCard, type CardData } from "./player-card";
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

  const data: CardData = {
    name: p.full_name,
    position: p.position,
    jersey: p.jersey_number,
    categoryLabel: t(`category_${category}`),
    category,
    initial: p.full_name.trim().charAt(0) || "؟",
    age,
    // No goals backend yet (no logging path) — the card renders an honest
    // "coming soon" state. Swap to the real count when Sweeper lands a source.
    goals: null,
    // Attendance HAS a real backend (M3 attendance table), but no per-player
    // aggregate query exists yet — flagged to Sweeper (getPlayerAttendance).
    // Honest "coming soon" until it lands; then pass the real %.
    attendance: null,
  };

  // Identity meta — the real, existing fields (calm strip under the card).
  const NS = t("not_set");
  const has = (v: string | number | null) => v != null && v !== "";
  const meta = [
    { label: t("age"), value: has(age) ? String(age) : NS, unit: has(age) ? t("age_unit") : undefined, mono: has(age) },
    { label: t("national_id"), value: p.national_id || NS, mono: has(p.national_id) },
    { label: t("height"), value: p.height_cm != null ? String(p.height_cm) : NS, unit: p.height_cm != null ? t("height_unit") : undefined, mono: p.height_cm != null },
    { label: t("guardian_phone"), value: p.guardian_phone || NS, mono: !!p.guardian_phone },
  ];

  return (
    <main className="relative isolate mx-auto w-full max-w-2xl pb-10" dir="rtl">
      <PlayerCard
        data={data}
        actions={
          <>
            <BackLink href={`/players/${category}/${teamId}`} label={t("back")} />
            <ProfileActions category={category} teamId={teamId} player={p} />
          </>
        }
      />

      {/* identity meta strip — real fields, below the pride card */}
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
