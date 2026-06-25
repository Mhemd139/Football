// Attendance route loader — header band + count strip + roster rows, shaped
// like the real screen so there's no layout jump when it resolves.
export default function AttendanceLoading() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col" dir="rtl">
      <header className="pitch-band pitch-band--header px-5 pb-4 pt-6">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-2">
            <div className="h-4 w-40 rounded bg-white/25" />
            <div className="h-3 w-28 rounded bg-white/15" />
          </div>
          <div className="h-11 w-11 rounded-xl bg-white/15" />
        </div>
        <div className="mt-3.5 grid grid-cols-4 gap-1.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[52px] rounded-[13px] bg-white/[0.13]" />
          ))}
        </div>
      </header>
      <div className="px-5 pb-1 pt-3">
        <div className="h-11 w-full rounded-xl skl" />
      </div>
      <div className="flex flex-col gap-2 px-5 pt-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-2xl border border-[#E3EAF1] p-2.5">
            <div className="h-10 w-10 flex-none rounded-xl skl" />
            <div className="flex flex-1 flex-col gap-1.5">
              <div className="h-3.5 w-36 skl" />
              <div className="h-2.5 w-20 skl" />
            </div>
            <div className="flex gap-1.5">
              <div className="h-11 w-11 rounded-xl skl" />
              <div className="h-11 w-11 rounded-xl skl" />
              <div className="h-11 w-11 rounded-xl skl" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
