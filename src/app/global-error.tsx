"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// Catches catastrophic crashes that take out the root layout. It REPLACES the
// root layout when it fires, so it renders its own <html>/<body> and cannot rely
// on the next-intl provider (it may not be mounted) — copy is inlined bilingual,
// styling inlined (globals.css/font vars aren't guaranteed during a crash).
// Reports to Sentry, then shows a warm RTL fallback with a reload — never a blank
// or English screen (Global Constraints: RTL-first, no blank screens).
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="ar" dir="rtl">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          background: "#FFFFFF",
          color: "#0B1A2E",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: "22rem" }}>
          <div style={{ fontSize: "44px", lineHeight: 1, marginBottom: "16px" }}>⚽️</div>
          <h1 style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 8px" }}>
            صار خطأ غير متوقّع
          </h1>
          <p style={{ fontSize: "15px", color: "#475569", margin: "0 0 4px" }}>
            جرّب تعيد فتح الصفحة. إذا ظلّ الخطأ، أبلغنا.
          </p>
          <p style={{ fontSize: "13px", color: "#94A3B8", margin: "0 0 24px" }}>
            אירעה שגיאה. נסה לטעון מחדש.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              minHeight: "44px",
              padding: "0 24px",
              fontSize: "16px",
              fontWeight: 600,
              color: "#FFFFFF",
              background: "#10B981",
              border: "none",
              borderRadius: "12px",
              cursor: "pointer",
            }}
          >
            إعادة المحاولة
          </button>
        </div>
      </body>
    </html>
  );
}
