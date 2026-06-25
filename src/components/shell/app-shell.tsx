"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { setLocale } from "@/lib/i18n/actions";
import { NAV_ITEMS, NavIcon, type NavItem } from "./nav-items";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";

type ShellProps = {
  children: React.ReactNode;
  locale: "ar" | "he";
  roleLabel: string;
  userName: string;
  userInitial: string;
};

const ACTIVE = "#2563EB";
const IDLE = "#7C8BA1"; // 3.44:1 on #FFFFFF — clears 3:1 graphics floor (was #94A3B8, 2.56:1)
const IDLE_MOBILE = "#7C8BA1"; // unify on the one passing idle stroke (was #C2CDD9, 1.61:1)

// Is `item` the current screen? Players sub-routes (/players/...) keep Players lit.
function isActive(item: NavItem, pathname: string): boolean {
  if (!item.href) return false;
  if (item.href === "/") return pathname === "/";
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

export function AppShell({ children, locale, roleLabel, userName, userInitial }: ShellProps) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const reduce = useReducedMotion();
  // Which disabled tab last showed its "قريبًا" tag (clears the previous one).
  const [soonKey, setSoonKey] = useState<NavItem["key"] | null>(null);
  const soonTimer = useRef<number | undefined>(undefined);

  function flagComingSoon(key: NavItem["key"]) {
    setSoonKey(key);
    window.clearTimeout(soonTimer.current);
    soonTimer.current = window.setTimeout(() => setSoonKey(null), 1800);
  }

  return (
    <div className="min-h-dvh bg-[#F4F7FB] lg:flex lg:flex-row-reverse">
      {/* ===== Desktop sidebar (right side, RTL) ===== */}
      <aside className="hidden lg:flex lg:w-[212px] lg:flex-none lg:flex-col lg:border-s lg:border-[#EEF2F6] lg:bg-white lg:px-3.5 lg:py-5">
        <Link href="/" className="mb-6 flex items-center gap-2.5 px-1.5">
          <span className="grid h-[38px] w-[38px] flex-none place-items-center rounded-xl bg-[#F4F7FB] ring-1 ring-[#D3E1F7]">
            <Image src="/assets/tfc-crest-circle.png" alt="" width={30} height={30} className="object-contain" />
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] font-bold text-[#0B1A2E]">الطيبة</span>
            <span className="block text-[10px] text-[#94A3B8]">{t("dashboard_label")}</span>
          </span>
        </Link>

        <nav className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item, pathname);
            const soon = soonKey === item.key;
            const stroke = active ? ACTIVE : IDLE;
            const label = (
              <>
                <NavIcon name={item.key} stroke={stroke} />
                <span className="flex-1">{t(item.key)}</span>
                {!item.href && (
                  <span
                    className={`rounded-full bg-[#EAF0FB] px-2 py-0.5 text-[9px] font-bold text-[#2455C4] transition-opacity ${soon ? "opacity-100" : "opacity-0"}`}
                  >
                    {t("coming_soon")}
                  </span>
                )}
              </>
            );
            const base =
              "relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] transition";
            if (item.href) {
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`${base} ${active ? "font-bold text-[#2563EB]" : "font-medium text-[#51637A] hover:bg-[#F4F7FB]"}`}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-pill-desktop"
                      className="absolute inset-0 rounded-xl bg-[#EAF0FB]"
                      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 32, mass: 0.9 }}
                    />
                  )}
                  <span className="relative flex flex-1 items-center gap-2.5">{label}</span>
                </Link>
              );
            }
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => flagComingSoon(item.key)}
                aria-disabled="true"
                className={`${base} w-full text-start font-medium text-[#C2CDD9]`}
              >
                {label}
              </button>
            );
          })}
        </nav>

        <LangToggle locale={locale} />

        <div className="mt-3 flex items-center gap-2.5 border-t border-[#EEF2F6] pt-3">
          <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-[#10B981] text-[13px] font-bold text-white">
            {userInitial}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[12px] font-semibold text-[#0B1A2E]">{userName}</span>
            <span className="block text-[10px] text-[#94A3B8]">{roleLabel}</span>
          </span>
        </div>
      </aside>

      {/* ===== Page content ===== */}
      <div className="flex min-w-0 flex-1 flex-col pb-[104px] lg:pb-0">{children}</div>

      {/* ===== Mobile bottom nav — floating, alive ===== */}
      <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(14px,env(safe-area-inset-bottom))] pt-2 lg:hidden">
        <nav className="flex justify-around rounded-[22px] border border-[#EAF0F7] bg-white/95 px-1.5 py-2 shadow-[0_8px_30px_rgba(11,26,46,0.12),0_2px_8px_rgba(11,26,46,0.05)] backdrop-blur-xl">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item, pathname);
            const soon = soonKey === item.key;
            const stroke = active ? ACTIVE : IDLE_MOBILE;
            const inner = (
              <>
                {/* icon box — active icon lifts up with a spring, sits on its pill */}
                <motion.span
                  className="relative grid h-9 w-9 place-items-center rounded-2xl"
                  animate={reduce ? {} : { y: active ? -2 : 0 }}
                  transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 26 }}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-2xl bg-gradient-to-b from-[#EAF4FF] to-[#E6F7EF] ring-1 ring-[#D3E1F7]"
                      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 32, mass: 0.9 }}
                    />
                  )}
                  <span className="relative">
                    <NavIcon name={item.key} stroke={stroke} />
                  </span>
                </motion.span>
                <span className={`text-[10px] font-semibold transition-colors ${active ? "text-[#2563EB]" : "text-[#94A3B8]"}`}>
                  {t(item.key)}
                </span>
                <AnimatePresence>
                  {!item.href && soon && (
                    <motion.span
                      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={reduce ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.9 }}
                      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 32, mass: 0.9 }}
                      className="absolute -top-8 whitespace-nowrap rounded-full bg-[#0B1A2E] px-2.5 py-1 text-[10px] font-bold text-white shadow-lg"
                    >
                      {t("coming_soon")}
                    </motion.span>
                  )}
                </AnimatePresence>
              </>
            );
            const cls = "relative flex flex-1 flex-col items-center gap-1 pt-0.5 transition-transform active:scale-90";
            if (item.href) {
              return (
                <Link key={item.key} href={item.href} className={cls}>
                  {inner}
                </Link>
              );
            }
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => flagComingSoon(item.key)}
                aria-disabled="true"
                className={`${cls} opacity-45`}
              >
                {inner}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

// عربي / עברית pill toggle — sets the locale cookie + re-renders server tree.
function LangToggle({ locale }: { locale: "ar" | "he" }) {
  const [pending, startTransition] = useTransition();
  const pick = (next: "ar" | "he") => {
    if (next === locale || pending) return;
    startTransition(() => setLocale(next));
  };
  const pill = (code: "ar" | "he", label: string) => (
    <button
      type="button"
      onClick={() => pick(code)}
      disabled={pending}
      className={`flex-1 rounded-full py-1.5 text-[12px] font-semibold transition disabled:opacity-60 ${
        locale === code
          ? "bg-[#0B1A2E] text-white"
          : "border border-[#DCE6F0] bg-white text-[#51637A]"
      }`}
    >
      {label}
    </button>
  );
  return (
    <div className="mt-2 flex gap-1.5">
      {pill("ar", "عربي")}
      {pill("he", "עברית")}
    </div>
  );
}
