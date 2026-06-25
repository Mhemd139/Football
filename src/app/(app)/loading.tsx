// Home route loader — gradient header shell + skeleton body.
export default function HomeLoading() {
  return (
    <main className="mx-auto w-full max-w-5xl" dir="rtl">
      <header className="pitch-band pitch-band--header px-6 pb-7 pt-12 lg:rounded-b-[28px]">
        <div className="h-4 w-20 rounded bg-white/25" />
        <div className="mt-3 h-6 w-2/3 rounded bg-white/25" />
        <div className="mt-5 grid grid-cols-3 gap-2.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 rounded-[13px] bg-white/15" />
          ))}
        </div>
      </header>
      <div className="grid gap-5 px-5 py-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-3 gap-2.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 rounded-[14px] skl" />
            ))}
          </div>
          <div className="h-20 rounded-2xl skl" />
          <div className="h-24 rounded-2xl skl" />
        </div>
        <div className="h-24 rounded-2xl skl" />
      </div>
    </main>
  );
}
