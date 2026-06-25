"use client";

import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { useEffect, useRef, type ReactNode } from "react";

// Keep keyboard + screen-reader focus inside an open modal, then give it back.
// On mount: remember what was focused, move focus to the first focusable inside
// (or the container). While open: Tab/Shift+Tab wrap within the modal — focus
// never lands on the page behind it. On close: restore the original focus.
function useFocusTrap<T extends HTMLElement>(onClose: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusables = () =>
      Array.from(
        node.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);

    (focusables()[0] ?? node).focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);
  return ref;
}

// Shared motion language for the whole app. One easing curve, one spring — so
// every sheet, modal, and list move with the same "weight". GPU-safe (transform
// + opacity only). prefers-reduced-motion collapses everything to instant.

// Calm, decisive ease-out (no linear / ease-in-out — those read as default).
export const EASE = [0.32, 0.72, 0, 1] as const;
export const SPRING = { type: "spring", stiffness: 380, damping: 32, mass: 0.9 } as const;

// A bottom sheet: scrim fades, panel springs up from below. Tap scrim / Esc to
// close is the caller's job (passed as onClose on the scrim).
export function BottomSheet({
  children,
  onClose,
  label,
}: {
  children: ReactNode;
  onClose: () => void;
  label: string;
}) {
  const reduce = useReducedMotion();
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);
  return (
    <div
      ref={trapRef}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex flex-col justify-end outline-none"
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <motion.button
        type="button"
        tabIndex={-1}
        aria-label={label}
        onClick={onClose}
        className="absolute inset-0 bg-[#0B1A2E]/45"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={reduce ? { duration: 0 } : { duration: 0.22, ease: EASE }}
      />
      <motion.div
        initial={reduce ? { opacity: 0 } : { y: "100%" }}
        animate={reduce ? { opacity: 1 } : { y: 0 }}
        exit={reduce ? { opacity: 0 } : { y: "100%" }}
        transition={reduce ? { duration: 0.15 } : SPRING}
        className="relative"
      >
        {children}
      </motion.div>
    </div>
  );
}

// A centered confirm/alert dialog: scrim fades, card scales+fades in.
export function CenterDialog({
  children,
  onClose,
  label,
}: {
  children: ReactNode;
  onClose: () => void;
  label: string;
}) {
  const reduce = useReducedMotion();
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);
  return (
    <div
      ref={trapRef}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center p-6 outline-none"
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <motion.button
        type="button"
        tabIndex={-1}
        aria-label={label}
        onClick={onClose}
        className="absolute inset-0 bg-[#0B1A2E]/45"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={reduce ? { duration: 0 } : { duration: 0.2, ease: EASE }}
      />
      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
        transition={reduce ? { duration: 0.15 } : { ...SPRING, stiffness: 420 }}
        className="relative w-full"
      >
        {children}
      </motion.div>
    </div>
  );
}

// Fade-up a section as it mounts. `delay` staggers siblings. Honors reduced motion.
export function FadeUp({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: EASE, delay: reduce ? 0 : delay }}
    >
      {children}
    </motion.div>
  );
}

export { AnimatePresence, motion, useReducedMotion };
