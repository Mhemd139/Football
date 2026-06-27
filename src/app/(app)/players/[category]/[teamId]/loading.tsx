// Roster route loader — mirrors the live team sheet: green→blue DNA header
// (back + crest tile + name + squad-count rail), the search field, and
// alive-card player rows with floodlit jersey tiles.
export default function RosterLoading() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col" dir="rtl">
      <header className="pitch-band pitch-band--home flex items-center gap-3 px-5 pb-6 pt-7 lg:rounded-b-[28px]">
        <div className="h-11 w-11 flex-none rounded-xl bg-white/[0.16] ring-1 ring-white/[0.28]" />
        <div className="h-[52px] w-[52px] flex-none rounded-2xl bg-white/[0.18] ring-1 ring-white/[0.28]" />
        <div className="flex flex-1 flex-col gap-1.5">
          <div className="h-5 w-32 rounded bg-white/35" />
          <div className="h-3 w-20 rounded bg-white/25" />
        </div>
        <div className="flex flex-none flex-col items-center gap-1.5">
          <div className="h-8 w-8 rounded bg-white/35" />
          <div className="h-2.5 w-10 rounded bg-white/25" />
        </div>
      </header>

      {/* search */}
      <div className="px-5 pb-1.5 pt-3">
        <div className="h-[42px] w-full rounded-xl skl" />
      </div>

      {/* player rows — alive-card + floodlit jersey tile */}
      <div className="flex flex-col gap-2.5 px-5 pt-1.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="alive-card flex items-center gap-3.5 p-3">
            <div className="h-[54px] w-[54px] flex-none rounded-2xl skl" />
            <div className="flex flex-1 flex-col gap-1.5">
              <div className="h-3.5 w-36 skl" />
              <div className="h-2.5 w-20 rounded-full skl" />
            </div>
            <div className="h-4 w-4 flex-none rounded skl" />
          </div>
        ))}
      </div>
    </main>
  );
}
