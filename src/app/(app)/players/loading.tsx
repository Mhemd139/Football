// Players team-sheet loader — hero band + paired youth cards, matching the
// real layout so there's no jump when content paints.
export default function PlayersLoading() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pb-12 pt-8" dir="rtl">
      <div className="mb-6 flex flex-col gap-2">
        <div className="h-7 w-28 skl" />
        <div className="h-3.5 w-44 skl" />
      </div>

      <div className="flex flex-col gap-3.5">
        {/* Bogrim hero band */}
        <div className="h-[108px] w-full rounded-[22px] skl" />
        {/* paired youth cards */}
        <div className="grid grid-cols-2 gap-3.5">
          <div className="h-[148px] rounded-[20px] skl" />
          <div className="h-[148px] rounded-[20px] skl" />
        </div>
      </div>

      <div className="mt-5 h-9 w-full skl" />
    </main>
  );
}
