// Money loader — mirrors the live screen: green→blue DNA header (crest + hero
// glass stat + glass tabs) and floodlit payment-row skeletons on the light body.
export default function MoneyLoading() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col bg-[#F4F7FB]" dir="rtl">
      <header className="pitch-band pitch-band--home px-5 pb-5 pt-7 lg:rounded-b-[28px]">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 flex-none rounded-xl bg-white/[0.16]" />
          <div className="h-[46px] w-[46px] flex-none rounded-2xl bg-white/[0.18] ring-1 ring-white/[0.28]" />
          <div className="h-5 w-20 flex-1 rounded bg-white/20" />
          <div className="h-7 w-24 rounded-full bg-white/[0.16]" />
        </div>

        {/* hero glass stat */}
        <div className="stat-glass mt-4 flex items-end justify-between rounded-2xl px-4 py-3.5">
          <div className="flex flex-col gap-2">
            <div className="h-3 w-24 rounded bg-white/30" />
            <div className="h-8 w-28 rounded bg-white/35" />
          </div>
          <div className="h-11 w-11 rounded-xl bg-white/[0.18] ring-1 ring-white/[0.26]" />
        </div>

        {/* glass segmented tabs */}
        <div className="mt-4 flex gap-1.5 rounded-2xl bg-white/[0.12] p-1 ring-1 ring-white/[0.18]">
          <div className="h-9 flex-1 rounded-xl bg-white/80" />
          <div className="h-9 flex-1 rounded-xl bg-white/15" />
        </div>
      </header>

      {/* toolbar: filter pills + generate */}
      <div className="flex items-center gap-2 px-4 pb-1.5 pt-3">
        <div className="flex flex-1 gap-1.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-7 w-14 flex-none rounded-full skl" />
          ))}
        </div>
        <div className="h-8 w-20 flex-none rounded-full skl" />
      </div>

      {/* floodlit payment-row skeletons */}
      <div className="flex flex-col gap-2 px-4 pt-1.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="alive-card flex items-center gap-3 p-3">
            <div className="h-[46px] w-[46px] flex-none rounded-2xl skl" />
            <div className="flex flex-1 flex-col gap-1.5">
              <div className="h-3.5 w-28 skl" />
              <div className="h-2.5 w-32 skl" />
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <div className="h-5 w-16 rounded-full skl" />
              <div className="h-3 w-12 skl" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
