// Sessions list loader — header band + session-row skeletons.
export default function EventsLoading() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col" dir="rtl">
      <header className="pitch-band pitch-band--header px-5 pb-5 pt-7">
        <div className="h-5 w-24 rounded bg-white/25" />
        <div className="mt-2 h-3 w-14 rounded bg-white/15" />
      </header>
      <div className="flex flex-col gap-2.5 px-5 pt-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-2xl border border-[#E3EAF1] p-3.5">
            <div className="h-11 w-11 flex-none rounded-xl skl" />
            <div className="flex flex-1 flex-col gap-1.5">
              <div className="h-3.5 w-32 skl" />
              <div className="h-2.5 w-40 skl" />
            </div>
            <div className="h-6 w-20 rounded-full skl" />
          </div>
        ))}
      </div>
    </main>
  );
}
