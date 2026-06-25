"use client";

import { motion, useReducedMotion } from "motion/react";

// The themed loading spinner: the real club ball, spinning smoothly. Lottie-ready
// — drop a designer-exported `ball.lottie` JSON and swap the <motion.img> for
// <Lottie animationData={...}/>; the API (size, label) stays the same.
export function BallLoader({ size = 48, label }: { size?: number; label?: string }) {
  const reduce = useReducedMotion();
  return (
    <div role="status" aria-label={label ?? "تحميل"} className="flex flex-col items-center gap-3">
      <motion.img
        src="/assets/ball.png"
        alt=""
        width={size}
        height={size}
        className="object-contain"
        style={{ filter: "drop-shadow(0 3px 6px rgba(11,26,46,.20))" }}
        animate={reduce ? undefined : { rotate: 360 }}
        transition={reduce ? undefined : { repeat: Infinity, ease: "linear", duration: 1.1 }}
      />
      {label && <span className="text-[13px] font-medium text-[#6B7A8D]">{label}</span>}
    </div>
  );
}
