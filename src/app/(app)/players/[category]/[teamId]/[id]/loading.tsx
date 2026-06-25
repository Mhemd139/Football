import { BallLoader } from "@/components/loaders/ball-loader";

// Player profile route loader — themed ball spinner over the hero shape.
export default function ProfileLoading() {
  return (
    <main className="mx-auto w-full max-w-4xl" dir="rtl">
      <div className="pitch-band pitch-band--hero flex h-[180px] items-center justify-center">
        <BallLoader size={44} />
      </div>
      <div className="grid gap-2.5 px-6 py-5 sm:grid-cols-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl skl" />
        ))}
      </div>
    </main>
  );
}
