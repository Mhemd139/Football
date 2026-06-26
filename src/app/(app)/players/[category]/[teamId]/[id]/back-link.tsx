import Link from "next/link";

// Glass back button for the player-card hero (server component).
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="-m-1 grid h-11 w-11 flex-none place-items-center rounded-xl bg-white/[0.16] text-white ring-1 ring-white/[0.28] backdrop-blur-sm transition-colors hover:bg-white/[0.24]"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M15 6l-6 6 6 6" />
      </svg>
    </Link>
  );
}
