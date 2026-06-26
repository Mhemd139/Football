// Home loader — mirrors the live screen: green→blue DNA header (crest lockup +
// hero players-stat chip + two "soon" stats) and the quick-actions / manage card
// skeletons on the light body. Skeleton tones are kept high-contrast on each
// surface so the loading shape reads clearly.
export default function HomeLoading() {
  return (
    <main dir="rtl" className="mx-auto w-full max-w-5xl">
      <header className="pitch-band pitch-band--home px-6 pb-8 pt-11 lg:rounded-b-[28px]">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3.5">
            <div className="h-[58px] w-[58px] flex-none rounded-2xl bg-white/[0.22] ring-1 ring-white/[0.3]" />
            <div className="flex flex-col gap-2">
              <div className="h-3.5 w-24 rounded bg-white/30" />
              <div className="h-5 w-32 rounded bg-white/40" />
            </div>
          </div>
          <div className="h-[38px] w-[38px] rounded-full bg-white/[0.16] ring-1 ring-white/[0.24]" />
        </div>

        {/* tagline */}
        <div className="mt-5 h-6 w-2/3 rounded bg-white/35" />

        {/* stat row — wide hero chip + two stacked soon-stats */}
        <div className="mt-5 flex items-stretch gap-2.5">
          <div className="stat-glass flex flex-[1.4] items-center gap-3 rounded-[16px] px-4 py-3.5">
            <div className="h-11 w-11 flex-none rounded-2xl bg-white/[0.28]" />
            <div className="flex flex-col gap-2">
              <div className="h-8 w-12 rounded bg-white/40" />
              <div className="h-3 w-16 rounded bg-white/30" />
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-2.5">
            <div className="stat-glass h-1/2 rounded-[14px]" />
            <div className="stat-glass h-1/2 rounded-[14px]" />
          </div>
        </div>
      </header>

      <div className="grid gap-5 px-5 py-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="flex flex-col gap-5">
          {/* quick actions */}
          <div>
            <div className="mb-2.5 h-3 w-20 rounded skl" />
            <div className="grid grid-cols-3 gap-2.5">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-[88px] rounded-[14px] skl" />
              ))}
            </div>
          </div>
          {/* manage players focal card */}
          <div>
            <div className="mb-2.5 h-3 w-24 rounded skl" />
            <div className="h-[72px] rounded-[20px] skl" />
          </div>
        </div>
        {/* side column */}
        <div className="h-[120px] rounded-2xl skl" />
      </div>
    </main>
  );
}
