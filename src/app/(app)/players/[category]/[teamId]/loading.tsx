// Roster route loader — skeleton rows shaped like the real list.
export default function RosterLoading() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col" dir="rtl">
      <header className="pitch-band pitch-band--header flex items-center gap-2.5 px-5 pb-4 pt-6">
        <div className="h-11 w-11 rounded-2xl bg-white/20" />
        <div className="flex flex-col gap-1.5">
          <div className="h-4 w-24 rounded bg-white/20" />
          <div className="h-7 w-12 rounded bg-white/25" />
        </div>
      </header>
      <div className="px-5 pb-1.5 pt-3">
        <div className="h-10 w-full rounded-xl skl" />
      </div>
      <div className="flex flex-col gap-3 px-5 pt-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-1">
            <div className="h-9 w-9 flex-none rounded-full skl" />
            <div className="flex flex-1 flex-col gap-1.5">
              <div className="h-3.5 w-40 skl" />
              <div className="h-2.5 w-20 skl" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
