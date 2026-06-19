"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { sendOtp, verifyOtp } from "@/lib/auth/actions";
import { normalizeIsraeliPhone } from "@/lib/auth/phone";

const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;

// login.html palette
const INK = "#0B1A2E";
const MUTED = "#6B7A8D";
const LABEL = "#51637A";
const BORDER = "#DCE6F0";
const ERR = "#C0392B";
const CHROME = "#2563EB"; // design's auth-button blue (own design call; AA ~5.1:1)

type Translate = ReturnType<typeof useTranslations<"auth">>;

export function AuthFlow() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");

  return step === "phone" ? (
    <PhoneStep
      t={t}
      onSent={(e164) => {
        setPhone(e164);
        setStep("otp");
      }}
    />
  ) : (
    <OtpStep
      t={t}
      phone={phone}
      onBack={() => setStep("phone")}
      onVerified={() => {
        router.replace("/");
        router.refresh();
      }}
    />
  );
}

/* Responsive shell (design/login.html): mobile = full-screen light gradient
   form; desktop ≥900px = split-screen with a branded blue→green panel. */
function AuthCard({ t, children }: { t: Translate; children: ReactNode }) {
  return (
    <div className="auth-shell">
      <BrandPanel t={t} />
      <div className="auth-form-pane">
        {/* decorative circles — only on the mobile light gradient */}
        <div
          aria-hidden
          className="auth-mobile-circle"
          style={{
            position: "absolute",
            right: -60,
            top: -60,
            width: 220,
            height: 220,
            border: "2px solid rgba(16,185,129,.16)",
            borderRadius: "50%",
          }}
        />
        <div
          aria-hidden
          className="auth-mobile-circle"
          style={{
            position: "absolute",
            left: -50,
            top: 60,
            width: 150,
            height: 150,
            border: "2px solid rgba(37,99,235,.14)",
            borderRadius: "50%",
          }}
        />
        <div className="auth-form-inner">{children}</div>
      </div>
    </div>
  );
}

/* Desktop-only branded panel: crest, club tagline, decorative circles,
   pitch-line texture over the blue→green gradient. */
function BrandPanel({ t }: { t: Translate }) {
  return (
    <div className="auth-brand">
      <div
        aria-hidden
        style={{
          position: "absolute",
          right: -60,
          top: -60,
          width: 280,
          height: 280,
          border: "2px solid rgba(255,255,255,.18)",
          borderRadius: "50%",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: -50,
          bottom: -50,
          width: 200,
          height: 200,
          border: "2px solid rgba(255,255,255,.14)",
          borderRadius: "50%",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.5,
          backgroundImage:
            "repeating-linear-gradient(90deg, transparent 0 58px, rgba(255,255,255,.06) 58px 60px)",
        }}
      />
      <div style={{ position: "relative" }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            overflow: "hidden",
            boxShadow: "0 8px 22px rgba(0,0,0,.18)",
            marginBottom: 24,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/tfc-crest-circle.png"
            alt={t("club")}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        </div>
        <h2
          style={{
            margin: "0 0 10px",
            fontSize: 32,
            fontWeight: 700,
            lineHeight: 1.12,
          }}
        >
          {t("brand_title")}
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: 15,
            color: "rgba(255,255,255,.82)",
            maxWidth: 320,
            lineHeight: 1.6,
          }}
        >
          {t("brand_subtitle")}
        </p>
      </div>
    </div>
  );
}

function FieldLabel({ children, error }: { children: ReactNode; error?: boolean }) {
  return (
    <label
      style={{
        display: "block",
        fontSize: 12,
        fontWeight: 600,
        color: error ? ERR : LABEL,
        marginBottom: 7,
      }}
    >
      {children}
    </label>
  );
}

function PrimaryButton({
  children,
  disabled,
}: {
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={disabled}
      style={{
        width: "100%",
        minHeight: 48,
        border: "none",
        background: CHROME,
        color: "#fff",
        fontFamily: "inherit",
        fontSize: 16,
        fontWeight: 700,
        padding: 15,
        borderRadius: 13,
        boxShadow: "0 10px 24px rgba(37,99,235,.32)",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.72 : 1,
      }}
    >
      {children}
    </button>
  );
}

function ErrorLine({ message }: { message: string }) {
  return (
    <div
      role="alert"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 7,
        margin: "0 0 18px",
        color: ERR,
        fontSize: 12.5,
        fontWeight: 600,
      }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={ERR} strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v6M12 16v.5" />
      </svg>
      {message}
    </div>
  );
}

function CrestHeader({ t, title }: { t: Translate; title: string }) {
  return (
    <>
      <div
        className="auth-mobile-crest"
        style={{
          width: 76,
          height: 76,
          borderRadius: 22,
          background: "#fff",
          display: "grid",
          placeItems: "center",
          boxShadow: "0 12px 30px rgba(37,99,235,.16)",
          margin: "0 0 22px",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/tfc-crest-circle.png"
          alt={t("club")}
          width={58}
          height={58}
          style={{ objectFit: "contain" }}
        />
      </div>
      <h1 style={{ margin: "0 0 4px", fontSize: 25, fontWeight: 700, color: INK }}>
        {title}
      </h1>
      <p style={{ margin: "0 0 26px", fontSize: 14, color: MUTED }}>{t("club")}</p>
    </>
  );
}

function LangPills() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        gap: 7,
        marginTop: 20,
      }}
    >
      <span
        style={{
          padding: "5px 13px",
          borderRadius: 999,
          background: INK,
          color: "#fff",
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        عربي
      </span>
      <span
        style={{
          padding: "5px 13px",
          borderRadius: 999,
          background: "#fff",
          border: `1px solid ${BORDER}`,
          color: LABEL,
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        עברית
      </span>
    </div>
  );
}

function PhoneStep({
  t,
  onSent,
}: {
  t: Translate;
  onSent: (e164: string) => void;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const e164 = normalizeIsraeliPhone(value);
    if (!e164) {
      setError(t("invalid_phone"));
      return;
    }
    startTransition(async () => {
      const res = await sendOtp(e164);
      if (!res.ok) {
        setError(t(res.error));
        return;
      }
      onSent(e164);
    });
  }

  return (
    <AuthCard t={t}>
      <CrestHeader t={t} title={t("phone_title")} />
      <form onSubmit={submit} noValidate>
        <FieldLabel>{t("phone_label")}</FieldLabel>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "#fff",
            border: `1.5px solid ${BORDER}`,
            borderRadius: 13,
            padding: "13px 14px",
            marginBottom: error ? 12 : 24,
          }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.8" aria-hidden="true">
            <path d="M5 4h4l2 5-3 2a12 12 0 005 5l2-3 5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" />
          </svg>
          <input
            className="num"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            dir="ltr"
            placeholder={t("phone_placeholder")}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={pending}
            aria-label={t("phone_label")}
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              background: "transparent",
              fontSize: 15,
              color: INK,
            }}
          />
        </div>
        {error && <ErrorLine message={error} />}
        <PrimaryButton disabled={pending}>
          {pending ? t("sending") : t("send_button")}
        </PrimaryButton>
        <LangPills />
      </form>
    </AuthCard>
  );
}

function OtpStep({
  t,
  phone,
  onBack,
  onVerified,
}: {
  t: Translate;
  phone: string;
  onBack: () => void;
  onVerified: () => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const digits = code.split("");

  const runVerify = useCallback(
    (val: string) => {
      setError(null);
      startTransition(async () => {
        const res = await verifyOtp(phone, val);
        if (!res.ok) {
          setError(t(res.error));
          setCode("");
          inputRef.current?.focus();
          return;
        }
        onVerified();
      });
    },
    [phone, t, onVerified],
  );

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  // Android WebOTP one-tap — progressive enhancement, paired with the SMS
  // "@domain #code" line. Silent where unsupported; aborted on unmount.
  useEffect(() => {
    if (typeof window === "undefined" || !("OTPCredential" in window)) return;
    const ac = new AbortController();
    navigator.credentials
      .get({
        // @ts-expect-error — WebOTP `otp` option not in the DOM lib types yet
        otp: { transport: ["sms"] },
        signal: ac.signal,
      })
      .then((cred) => {
        const otp = (cred as { code?: string } | null)?.code;
        if (!otp) return;
        const clean = otp.replace(/\D/g, "").slice(0, OTP_LENGTH);
        setCode(clean);
        if (clean.length === OTP_LENGTH) runVerify(clean);
      })
      .catch(() => {
        /* dismissed/unsupported — manual entry still works */
      });
    return () => ac.abort();
  }, [runVerify]);

  function onCodeChange(raw: string) {
    const clean = raw.replace(/\D/g, "").slice(0, OTP_LENGTH);
    setCode(clean);
    setError(null);
    if (clean.length === OTP_LENGTH) runVerify(clean);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (code.length !== OTP_LENGTH) {
      setError(t("invalid_code"));
      return;
    }
    runVerify(code);
  }

  function resend() {
    if (cooldown > 0 || pending) return;
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await sendOtp(phone);
      if (!res.ok) {
        setError(t(res.error));
        return;
      }
      setNotice(t("resent"));
      setCooldown(RESEND_SECONDS);
      setCode("");
      inputRef.current?.focus();
    });
  }

  return (
    <AuthCard t={t}>
      <CrestHeader t={t} title={t("otp_title")} />
      <p
        style={{
          margin: "-18px 0 22px",
          fontSize: 13,
          color: MUTED,
          lineHeight: 1.5,
        }}
      >
        {t("otp_subtitle")}
        <span className="num" style={{ fontWeight: 600, color: INK }}>
          {phone}
        </span>
      </p>

      <form onSubmit={submit} noValidate>
        <FieldLabel error={!!error}>{t("otp_label")}</FieldLabel>
        {/* One real input carries one-time-code so iOS/Android autofill targets
            a single field; the 6 boxes mirror its value. */}
        <div
          style={{ position: "relative", marginBottom: error ? 12 : 24 }}
          onClick={() => inputRef.current?.focus()}
        >
          <input
            ref={inputRef}
            type="text"
            autoComplete="one-time-code"
            inputMode="numeric"
            maxLength={OTP_LENGTH}
            value={code}
            onChange={(e) => onCodeChange(e.target.value)}
            disabled={pending}
            dir="ltr"
            aria-label={t("otp_label")}
            autoFocus
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              opacity: 0,
              cursor: "pointer",
              zIndex: 2,
            }}
          />
          <div dir="ltr" style={{ display: "flex", gap: 8 }}>
            {Array.from({ length: OTP_LENGTH }).map((_, i) => {
              const active = i === code.length;
              return (
                <div
                  key={i}
                  className="num"
                  style={{
                    flex: 1,
                    height: 54,
                    display: "grid",
                    placeItems: "center",
                    background: "#fff",
                    border: `1.5px solid ${
                      error ? "#E7A6A0" : active ? CHROME : BORDER
                    }`,
                    borderRadius: 13,
                    fontSize: 22,
                    fontWeight: 600,
                    color: INK,
                  }}
                >
                  {digits[i] ?? ""}
                </div>
              );
            })}
          </div>
        </div>

        {error && <ErrorLine message={error} />}
        {notice && !error && (
          <div
            style={{
              margin: "0 0 18px",
              fontSize: 12.5,
              fontWeight: 600,
              color: "#047857",
            }}
          >
            {notice}
          </div>
        )}

        <PrimaryButton disabled={pending}>
          {pending ? t("verifying") : t("verify_button")}
        </PrimaryButton>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 16,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <button
            type="button"
            onClick={onBack}
            style={{
              border: "none",
              background: "none",
              padding: 0,
              cursor: "pointer",
              color: CHROME,
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {t("change_phone")}
          </button>
          <button
            type="button"
            onClick={resend}
            disabled={cooldown > 0 || pending}
            style={{
              border: "none",
              background: "none",
              padding: 0,
              cursor: cooldown > 0 || pending ? "default" : "pointer",
              color: cooldown > 0 || pending ? "#94A3B8" : CHROME,
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: cooldown > 0 ? 500 : 600,
            }}
          >
            {cooldown > 0 ? t("resend_in", { seconds: cooldown }) : t("resend")}
          </button>
        </div>
      </form>

      <p
        style={{
          margin: "20px 0 0",
          textAlign: "center",
          fontSize: 12,
          lineHeight: 1.5,
          color: MUTED,
        }}
      >
        {t("trust_device")}
      </p>
    </AuthCard>
  );
}
