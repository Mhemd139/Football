import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { Category } from "@/lib/players/actions";

// /players — the 3 category cards. Categories are static domain model, no DB call.
// Bogrim uses blue (Atlas ruling #5: no purple); the "club pays" badge + label
// carry its salaried meaning, and the icon-tile tint differs per category.
const CATEGORIES: {
  key: Category;
  tile: string;
  iconStroke: string;
  pays: boolean;
}[] = [
  { key: "beet_sefer", tile: "#EAF0FB", iconStroke: "#2563EB", pays: true },
  { key: "league", tile: "#E7F8F0", iconStroke: "#10B981", pays: true },
  { key: "bogrim", tile: "#DCE9FF", iconStroke: "#2455C4", pays: false },
];

function ShirtIcon({ stroke }: { stroke: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.7" aria-hidden="true">
      <path d="M8 3l-5 3 1.5 4L7 9v11h10V9l2.5 1L21 6l-5-3-2 2a3 3 0 01-4 0L8 3z" />
    </svg>
  );
}

export default async function PlayersPage() {
  const t = await getTranslations("players");

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-8" dir="rtl">
      <header className="mb-6">
        <h1 className="text-xl font-bold text-[#0B1A2E]">{t("title")}</h1>
        <p className="mt-1 text-sm text-[#6B7A8D]">
          {t("categories_summary", { count: 3 })}
        </p>
      </header>

      <div className="flex flex-col gap-3">
        {CATEGORIES.map((c) => (
          <Link
            key={c.key}
            href={`/players/${c.key}`}
            className="flex items-center gap-3.5 rounded-2xl border border-[#E3EAF1] bg-white p-3.5 transition hover:border-[#C7D7F0] hover:shadow-sm"
          >
            <div
              className="grid h-12 w-12 flex-none place-items-center rounded-xl"
              style={{ background: c.tile }}
            >
              <ShirtIcon stroke={c.iconStroke} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-[#0B1A2E]">
                {t(`category_${c.key}`)}
              </div>
              <div className="mb-1.5 mt-0.5 text-xs text-[#6B7A8D]">
                {t(`desc_${c.key}`)}
              </div>
              <span
                className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold"
                style={
                  c.pays
                    ? { background: "#E7F8F0", color: "#047857" }
                    : { background: "#EAF0FB", color: "#2455C4" }
                }
              >
                {c.pays ? t("pays_dues") : t("club_pays")}
              </span>
            </div>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#C2CDD9" strokeWidth="2" aria-hidden="true">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </Link>
        ))}

        <div className="mt-1 flex items-center gap-2.5 rounded-xl bg-[#EAF0FB] px-3.5 py-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5M12 8v.5" />
          </svg>
          <span className="text-[11.5px] leading-relaxed text-[#2455C4]">
            {t("bogrim_note")}
          </span>
        </div>
      </div>
    </main>
  );
}
