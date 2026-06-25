import Link from "next/link";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { teamPlayerCounts, type Category } from "@/lib/players/actions";
import { FadeUp } from "@/components/motion/primitives";

// Home — "يوم المدرّب" (design §02). Header + real player stats; today's sessions
// and the dues alert are M3/M4 slots, shown as labeled placeholders (no mocks).

function greetingKey(): "greeting_morning" | "greeting_afternoon" | "greeting_evening" {
  const h = new Date().getHours();
  if (h < 12) return "greeting_morning";
  if (h < 17) return "greeting_afternoon";
  return "greeting_evening";
}

// Active players per category = sum of its teams' counts. Category is derived
// through the team now, so we total teamPlayerCounts per category.
async function categoryTotal(category: Category): Promise<number> {
  const res = await teamPlayerCounts(category);
  if (!res.ok) return 0;
  return Object.values(res.data).reduce((sum, n) => sum + n, 0);
}

export default async function HomePage() {
  const t = await getTranslations("home");
  const tp = await getTranslations("players");

  const cats: { key: "beet_sefer" | "league" | "bogrim" }[] = [
    { key: "beet_sefer" },
    { key: "league" },
    { key: "bogrim" },
  ];

  // Three independent reads — run them together.
  const [beet_sefer, league, bogrim] = await Promise.all([
    categoryTotal("beet_sefer"),
    categoryTotal("league"),
    categoryTotal("bogrim"),
  ]);
  const counts = { beet_sefer, league, bogrim, total: beet_sefer + league + bogrim };

  return (
    <main dir="rtl" className="mx-auto w-full max-w-5xl">
      {/* ===== Header — green→blue, alive. The red crest is the hero: a large
          glass badge popping against the gradient. ===== */}
      <header className="pitch-band pitch-band--home px-6 pb-8 pt-11 lg:rounded-b-[28px]">
        <div className="relative flex items-start justify-between">
          {/* big crest + club lockup — the green/blue/red moment, at scale */}
          <div className="flex items-center gap-3.5">
            <span className="pitch-pop pitch-tile h-[58px] w-[58px] rounded-2xl shadow-[0_8px_20px_rgba(0,0,0,0.18)]">
              <Image src="/assets/tfc-crest-circle.png" alt="" width={42} height={42} className="object-contain" />
            </span>
            <div>
              <div className="flex items-center gap-1.5 text-[12.5px] font-medium text-white/90">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FCD34D" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" />
                </svg>
                {t(greetingKey())}
              </div>
              <div className="mt-0.5 text-[17px] font-bold leading-tight text-white">{t("club")}</div>
            </div>
          </div>
          <span aria-hidden className="grid h-[38px] w-[38px] place-items-center rounded-full bg-white/[0.16] ring-1 ring-white/[0.24] backdrop-blur-sm">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8">
              <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.7 21a2 2 0 01-3.4 0" />
            </svg>
          </span>
        </div>

        <h1 className="relative mt-5 text-[25px] font-bold leading-tight">{t("tagline")}</h1>

        {/* stats: the REAL players count is the hero chip; sessions/collected
            (M3/M4) sit beside it as small secondary "soon" chips, not blanks. */}
        <div className="relative mt-5 flex items-stretch gap-2.5">
          {/* hero stat — players, the live number, confident frosted chip */}
          <div className="stat-glass relative flex flex-[1.4] items-center gap-3 overflow-hidden rounded-[16px] px-4 py-3.5">
            <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/30" />
            <span className="grid h-11 w-11 flex-none place-items-center rounded-2xl bg-white/[0.22] ring-1 ring-white/[0.28]">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" aria-hidden="true">
                <circle cx="9" cy="8" r="3.2" />
                <path d="M3.5 19c0-3 2.4-4.3 5.5-4.3s5.5 1.3 5.5 4.3" />
                <path d="M16 5.2a3 3 0 010 5.6M17.5 14.8c2 .5 3 1.7 3 3.7" />
              </svg>
            </span>
            <div className="min-w-0">
              <div className="num text-[34px] font-bold leading-[0.9] tracking-tight text-white">{counts.total}</div>
              <div className="mt-1 text-[11.5px] font-semibold text-white/90">{t("stat_players")}</div>
            </div>
          </div>
          {/* secondary deferred stats — small, stacked, honestly "soon" */}
          <div className="flex flex-1 flex-col gap-2.5">
            <SoonStat label={t("stat_sessions")} soon={t("soon_badge")}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" aria-hidden="true">
                <circle cx="12" cy="13" r="7" />
                <path d="M12 13l3-2M9 3h6" />
              </svg>
            </SoonStat>
            <SoonStat label={t("stat_collected")} soon={t("soon_badge")}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M9 8v6a1 1 0 001 1h2M15 16v-6a1 1 0 00-1-1h-2" />
              </svg>
            </SoonStat>
          </div>
        </div>
      </header>

      <div className="grid gap-5 px-5 py-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="flex flex-col gap-5">
          {/* ===== Quick actions ===== */}
          <FadeUp delay={0.05}>
            <h2 className="mb-2.5 text-[12px] font-bold text-[#51637A]">{t("quick_actions")}</h2>
            <div className="grid grid-cols-3 gap-2.5">
              <QuickAction grad="linear-gradient(135deg, #10B981 0%, #059669 100%)" shadow="shadow-[0_6px_14px_rgba(16,185,129,0.34)]" label={t("qa_payment")} soon={t("soon_badge")}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M9 8v6a1 1 0 001 1h2M15 16v-6a1 1 0 00-1-1h-2" />
                </svg>
              </QuickAction>
              <QuickAction grad="linear-gradient(135deg, #2563EB 0%, #1E40AF 100%)" shadow="shadow-[0_6px_14px_rgba(37,99,235,0.34)]" label={t("qa_attendance")} soon={t("soon_badge")}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" aria-hidden="true">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </QuickAction>
              <QuickAction grad="linear-gradient(135deg, #1AA0A8 0%, #1D8FCF 100%)" shadow="shadow-[0_6px_14px_rgba(29,143,207,0.34)]" label={t("qa_event")} soon={t("soon_badge")}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="17" rx="3" />
                  <path d="M3 9h18M8 2v4M16 2v4M12 13v4M10 15h4" />
                </svg>
              </QuickAction>
            </div>
          </FadeUp>

          {/* ===== Manage players — the focal card: green→blue blend band with
              the crest, echoing the board so Home feels part of the same club. ===== */}
          <FadeUp delay={0.12}>
            <h2 className="mb-2.5 text-[12px] font-bold text-[#51637A]">{t("manage_players")}</h2>
            <Link
              href="/players"
              className="group relative block overflow-hidden rounded-[20px] shadow-[0_12px_28px_rgba(16,135,120,0.24)] transition-transform active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2"
            >
              <div
                className="relative isolate flex items-center gap-3.5 p-4 text-white"
                style={{
                  background:
                    "radial-gradient(120% 140% at 10% 0%, rgba(52,211,153,.5) 0%, transparent 54%), linear-gradient(122deg, #10B981 0%, #1D8FCF 54%, #2563EB 100%)",
                }}
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 opacity-[0.13]"
                  style={{ backgroundImage: "repeating-linear-gradient(90deg, transparent 0 40px, rgba(255,255,255,.9) 40px 41px)" }}
                />
                <span className="grid h-12 w-12 flex-none place-items-center rounded-2xl bg-white/[0.18] ring-1 ring-white/[0.3] backdrop-blur-sm">
                  <Image src="/assets/tfc-crest-circle.png" alt="" width={30} height={30} className="object-contain" />
                </span>
                <span className="relative min-w-0 flex-1">
                  <span className="block text-[15px] font-bold">{tp("title")}</span>
                  <span className="mt-0.5 block text-[12px] text-white/85">
                    {t("players_total", { count: counts.total })}
                  </span>
                </span>
                {/* per-category mini counts (real) — glass chips on the band */}
                <span className="hidden items-center gap-1.5 sm:flex">
                  {cats.map((c) => (
                    <span
                      key={c.key}
                      className="grid h-9 w-9 place-items-center rounded-xl bg-white/[0.18] ring-1 ring-white/[0.26] backdrop-blur-sm"
                      title={tp(`category_${c.key}`)}
                    >
                      <span className="num text-[12px] font-bold text-white">{counts[c.key]}</span>
                    </span>
                  ))}
                </span>
                <svg className="relative" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" aria-hidden="true">
                  <path d="M15 6l-6 6 6 6" />
                </svg>
              </div>
            </Link>
          </FadeUp>

          {/* ===== Today's sessions — deferred (M3) ===== */}
          <FadeUp delay={0.19}>
            <div className="mb-2.5 flex items-center justify-between">
              <h2 className="text-[12px] font-bold text-[#51637A]">{t("today_sessions")}</h2>
            </div>
            <DeferredPanel title={t("deferred_sessions_title")} hint={t("deferred_sessions_hint")} soon={t("soon_badge")} />
          </FadeUp>
        </div>

        {/* ===== Needs attention — deferred (M4) ===== */}
        <FadeUp delay={0.26}>
          <h2 className="mb-2.5 text-[12px] font-bold text-[#51637A]">{t("needs_attention")}</h2>
          <DeferredPanel title={t("deferred_money_title")} hint={t("deferred_money_hint")} soon={t("soon_badge")} />
        </FadeUp>
      </div>
    </main>
  );
}

function SoonStat({ label, soon, children }: { label: string; soon: string; children: React.ReactNode }) {
  // A deferred (M3/M4) stat — small, honest "soon", but still alive (glass + icon).
  return (
    <div className="stat-glass--muted relative flex flex-1 items-center gap-2 overflow-hidden rounded-[14px] px-2.5 py-2">
      <span className="grid h-7 w-7 flex-none place-items-center rounded-lg bg-white/[0.12]">{children}</span>
      <span className="min-w-0 flex-1 truncate text-[10.5px] font-semibold text-white/85">{label}</span>
      <span className="rounded-full bg-white/[0.16] px-1.5 py-0.5 text-[8px] font-bold text-white/90">{soon}</span>
    </div>
  );
}

function QuickAction({ grad, shadow, label, soon, children }: { grad: string; shadow: string; label: string; soon: string; children: React.ReactNode }) {
  // Quick actions target M3/M4 screens — vivid + tactile (a "قريبًا" badge carries
  // the deferred signal; we don't dim the whole tile, which read as broken/dead).
  return (
    <div className="relative flex flex-col items-center gap-2 rounded-[16px] border border-[#EDF1F6] bg-white px-1.5 py-3.5">
      <span className={`pitch-pop grid h-11 w-11 place-items-center rounded-2xl ${shadow}`} style={{ background: grad }}>
        {children}
      </span>
      <span className="text-[10.5px] font-semibold text-[#3A4A5E]">{label}</span>
      <span className="absolute end-1.5 top-1.5 rounded-full bg-[#EEF2F7] px-1.5 py-0.5 text-[8px] font-bold text-[#5E6E80]">
        {soon}
      </span>
    </div>
  );
}

function DeferredPanel({ title, hint, soon }: { title: string; hint: string; soon: string }) {
  // Honestly "coming soon" but composed to feel intentional — a soft tinted
  // surface with a colored clock, not a dead grey-dashed box.
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#E2EFEA] bg-gradient-to-br from-[#F1FAF6] to-[#F4F8FF] p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-white shadow-[0_2px_6px_rgba(16,135,120,0.12)] ring-1 ring-[#D9EEE5]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="1.9" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v4l3 2" />
            </svg>
          </span>
          <span className="text-[13px] font-bold text-[#2E5A4E]">{title}</span>
        </div>
        <span className="rounded-full bg-[#047857] px-2 py-0.5 text-[9px] font-bold text-white shadow-[0_2px_6px_rgba(4,120,87,0.3)]">{soon}</span>
      </div>
      <p className="text-[11.5px] leading-relaxed text-[#5E7268]">{hint}</p>
    </div>
  );
}
