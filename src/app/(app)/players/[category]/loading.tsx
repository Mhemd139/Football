// Teams-list route loader — skeleton team cards shaped like the real list.
export default function TeamsLoading() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col" dir="rtl">
      <header className="pitch-band pitch-band--header flex items-center gap-2.5 px-5 pb-4 pt-6">
        <div className="h-11 w-11 rounded-2xl bg-white/20" />
        <div className="flex flex-col gap-1.5">
          <div className="h-4 w-24 rounded bg-white/20" />
          <div className="h-7 w-12 rounded bg-white/25" />
        </div>
      </header>
      <div className="flex flex-col gap-2.5 px-5 pt-3.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3.5 rounded-2xl border border-[#E3EAF1] p-3.5">
            <div className="h-11 w-11 flex-none rounded-xl skl" />
            <div className="flex flex-1 flex-col gap-1.5">
              <div className="h-3.5 w-32 skl" />
              <div className="h-2.5 w-16 skl" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
