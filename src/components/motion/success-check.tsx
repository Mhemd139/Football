"use client";

import { motion, useReducedMotion } from "motion/react";
import { EASE } from "./primitives";

// The canonical success confirmation: a green ring scales in, then the tick
// draws on. One success language for the whole app (player saved, attendance
// saved, payment recorded). GPU-safe — scale/opacity on the ring, SVG pathLength
// on the tick. prefers-reduced-motion shows the final state instantly, no motion.
//
// Purely visual — the mark is `aria-hidden`. The caller is expected to render
// the success text in a live region (so screen readers announce it once, not
// twice). `size` is the ring diameter in px.
export function SuccessCheck({ size = 64 }: { size?: number }) {
  const reduce = useReducedMotion();
  const s = size;
  // tick drawn in the viewBox's coordinate space (24×24), scaled by the SVG box
  return (
    <div aria-hidden="true" className="grid place-items-center">
      <motion.span
        className="grid place-items-center rounded-full"
        style={{ width: s, height: s, background: "#E7F8F0" }}
        initial={reduce ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={
          reduce
            ? { duration: 0 }
            : { type: "spring", stiffness: 420, damping: 22, mass: 0.8 }
        }
      >
        <svg
          width={s * 0.56}
          height={s * 0.56}
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <motion.path
            d="M5 12.5l4.2 4.3L19 7.2"
            stroke="#047857"
            strokeWidth={2.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={
              reduce
                ? { duration: 0 }
                : { duration: 0.26, ease: EASE, delay: 0.12 }
            }
          />
        </svg>
      </motion.span>
    </div>
  );
}
