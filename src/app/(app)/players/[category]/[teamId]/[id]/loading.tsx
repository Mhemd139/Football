// Player-card route loader — mirrors the simple identity+goals card: green→blue
// DNA hero (jersey tile + name + chips + motto), one goals block, identity strip.
export default function ProfileLoading() {
  return (
    <main aria-hidden="true" className="mx-auto w-full max-w-2xl pb-10" dir="rtl">
      {/* hero — alive --home band */}
      <header className="pitch-band pitch-band--home px-5 pb-6 pt-7 lg:rounded-b-[28px]">
        <div className="flex items-center justify-between">
          <div className="h-11 w-11 rounded-xl bg-white/[0.16] ring-1 ring-white/[0.28]" />
          <div className="flex gap-2">
            <div className="h-11 w-16 rounded-full bg-white/[0.16]" />
            <div className="h-11 w-16 rounded-full bg-white/[0.16]" />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-4">
          {/* floodlit jersey tile */}
          <div className="h-[78px] w-[78px] flex-none rounded-[22px] bg-white/[0.20] ring-1 ring-white/[0.28]" />
          <div className="min-w-0 flex-1">
            <div className="h-6 w-36 rounded bg-white/35" />
            <div className="mt-2 flex gap-1.5">
              <div className="h-5 w-16 rounded-full bg-white/[0.18]" />
              <div className="h-5 w-16 rounded-full bg-white/[0.18]" />
              <div className="h-5 w-12 rounded-full bg-white/[0.18]" />
            </div>
          </div>
        </div>

        <div className="mt-4 h-4 w-2/3 rounded bg-white/25" />
      </header>

      {/* focal stats — goals + attendance */}
      <section className="grid grid-cols-1 gap-2.5 px-5 pt-4 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="alive-card flex items-center gap-4 p-4">
            <div className="h-[56px] w-[56px] flex-none rounded-2xl skl" />
            <div className="min-w-0 flex-1">
              <div className="h-3 w-24 rounded skl" />
              <div className="mt-2 h-7 w-16 rounded skl" />
            </div>
          </div>
        ))}
      </section>

      {/* identity strip */}
      <section className="px-5 pt-5">
        <div className="mb-3 h-4 w-16 rounded skl" />
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl skl" />
          ))}
        </div>
      </section>
    </main>
  );
}
