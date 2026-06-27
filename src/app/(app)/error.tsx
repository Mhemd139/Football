"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { useTranslations } from "next-intl";

// Per-screen crash boundary inside the app shell. Unlike global-error, the
// next-intl provider IS mounted here, so copy is localized (ar/he). Reports to
// Sentry once per distinct crash (keyed on digest), then offers retry via reset()
// — never a blank screen (Global Constraints).
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");

  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main
      dir="rtl"
      className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col items-center justify-center px-6 text-center"
    >
      <div className="mb-4 text-4xl" aria-hidden="true">
        ⚽️
      </div>
      <h1 className="mb-2 text-lg font-bold text-[#0B1A2E]">{t("title")}</h1>
      <p className="mb-6 text-sm text-slate-500">{t("body")}</p>
      <button
        type="button"
        onClick={reset}
        className="min-h-[44px] rounded-xl bg-[#10B981] px-6 text-base font-semibold text-white"
      >
        {t("retry")}
      </button>
    </main>
  );
}
