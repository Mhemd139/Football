import type { ReactNode } from "react";

// The 5 app destinations, in RTL nav order. `href` null = a later milestone
// (Calendar/Money/Admin) — rendered dimmed + a "قريبًا" tag on tap, never a dead link.
export type NavItem = {
  key: "home" | "players" | "calendar" | "money" | "admin";
  href: string | null;
};

export const NAV_ITEMS: NavItem[] = [
  { key: "home", href: "/" },
  { key: "players", href: "/players" },
  { key: "calendar", href: null },
  { key: "money", href: null },
  { key: "admin", href: null },
];

// Design §00 football icon set — 24-box SVGs, stroke set by caller (active/idle).
export function NavIcon({ name, stroke }: { name: NavItem["key"]; stroke: string }): ReactNode {
  const common = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke, strokeWidth: 1.8, "aria-hidden": true } as const;
  switch (name) {
    case "home":
      return (
        <svg {...common}>
          <path d="M4 11l8-7 8 7" />
          <path d="M6 10v9h12v-9" />
        </svg>
      );
    case "players": // group of people (a roster / squad)
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3.4" />
          <path d="M3 19c0-3 2.6-4.5 6-4.5s6 1.5 6 4.5" />
          <path d="M16 5.2a3.2 3.2 0 010 5.8M17.5 14.4c2.3.5 3.5 1.9 3.5 4.1" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="17" rx="3" />
          <path d="M3 9h18M8 2v4M16 2v4" />
        </svg>
      );
    case "money": // shekel
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9 8v6a1 1 0 001 1h2M15 16v-6a1 1 0 00-1-1h-2" />
        </svg>
      );
    case "admin": // person
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M5 20c0-3.5 3-5 7-5s7 1.5 7 5" />
        </svg>
      );
  }
}
