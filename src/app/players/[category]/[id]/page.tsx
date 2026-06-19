import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getPlayer, type Category } from "@/lib/players/actions";
import { Constants } from "@/lib/supabase/types";
import { ProfileActions } from "./profile-actions";

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
  params: Promise<{ category: string; id: string }>;
}) {
  const { category, id } = await params;
  if (!isCategory(category)) notFound();

  const t = await getTranslations("players");
  const res = await getPlayer(id);
  if (!res.ok) notFound();
  const p = res.data;

  const age = ageFrom(p.birthdate);
  // mono = whole value is mono/LTR (codes, "#7"); unit = number is mono but the
  // Arabic unit word ("سنة"/"سم") stays normal RTL; plain = normal Arabic text.
  const NS = t("not_set");
  const has = (v: string | number | null) => v != null && v !== "";
  const meta = [
    { label: t("age"), value: has(age) ? String(age) : NS, unit: has(age) ? t("age_unit") : undefined, mono: has(age) },
    { label: t("national_id"), value: p.national_id || NS, mono: has(p.national_id) },
    { label: t("jersey"), value: p.jersey_number != null ? `#${p.jersey_number}` : NS, mono: p.jersey_number != null },
    { label: t("height"), value: p.height_cm != null ? String(p.height_cm) : NS, unit: p.height_cm != null ? t("height_unit") : undefined, mono: p.height_cm != null },
    { label: t("guardian"), value: p.guardian_name || NS, mono: false },
  ];

  return (
    <main className="mx-auto w-full max-w-4xl pb-10" dir="rtl">
      {/* hero */}
      <div
        className="relative overflow-hidden px-6 pb-6 pt-8 text-white"
        style={{ background: "linear-gradient(120deg, #2563EB 0%, #1E40AF 70%)" }}
      >
        <div
          aria-hidden
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, transparent 0 58px, rgba(255,255,255,.06) 58px 60px)",
          }}
        />
        <div className="relative mb-4 flex items-center justify-between">
          <Link
            href={`/players/${category}`}
            aria-label={t("back")}
            className="grid h-9 w-9 place-items-center rounded-full bg-white/20"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" aria-hidden="true">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </Link>
          <ProfileActions category={category} player={p} />
        </div>
        <div className="relative flex items-center gap-4">
          <div className="relative grid h-[68px] w-[68px] flex-none place-items-center rounded-full border-2 border-white/55 bg-white/20 text-2xl font-bold">
            {p.full_name.trim().charAt(0)}
            {p.jersey_number != null && (
              <span className="num absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full border-2 border-[#2563EB] bg-white text-[11px] text-[#2563EB]">
                {p.jersey_number}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[22px] font-bold">{p.full_name}</h1>
              <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold">
                {t(`category_${category}`)}
              </span>
            </div>
            {p.position && (
              <div className="mt-1 text-[13px] text-white/85">{p.position}</div>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-5 px-6 py-5 lg:grid-cols-[1fr_1.1fr]">
        {/* identity meta strip */}
        <section>
          <h2 className="mb-3 text-sm font-bold text-[#0B1A2E]">
            {t("identity")}
          </h2>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-2">
            {meta.map((m) => (
              <div key={m.label} className="rounded-xl bg-[#F4F7FB] px-3 py-2.5">
                <div className="mb-0.5 text-[10px] font-semibold text-[#94A3B8]">
                  {m.label}
                </div>
                <div className="text-sm font-bold text-[#0B1A2E]">
                  <span className={m.mono ? "num" : undefined}>{m.value}</span>
                  {m.unit && <span className="text-[#51637A]"> {m.unit}</span>}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Deferred panels — the M3-M5 data slots, shown as labeled placeholders
            so the layout already reads right (owner guardrail). NOT mocked. */}
        <section className="flex flex-col gap-3">
          <DeferredPanel title={t("deferred_performance")} hint={t("deferred_hint")} />
          <DeferredPanel title={t("deferred_attendance")} hint={t("deferred_hint")} />
          <DeferredPanel title={t("deferred_money")} hint={t("deferred_hint")} />
        </section>
      </div>
    </main>
  );
}

// A labeled slot for a panel whose data arrives in a later milestone (M3-M5).
// Reads as intentional ("coming when data lands"), never as a broken/empty card.
function DeferredPanel({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#D5DEE8] bg-[#FAFBFC] p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#EEF2F6]">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.8" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v4l3 2" />
          </svg>
        </span>
        <span className="text-[13px] font-bold text-[#51637A]">{title}</span>
      </div>
      <p className="text-[11.5px] text-[#94A3B8]">{hint}</p>
    </div>
  );
}
