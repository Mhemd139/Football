"use server";

import { createClient } from "@/lib/supabase/server";
import { LOCALES, DEFAULT_LOCALE, type Locale } from "@/i18n/request";
import type { Enums } from "@/lib/supabase/types";

type ActionResult = { ok: true } | { ok: false; error: string };

// Send a phone OTP. Dev uses Supabase test numbers (fixed code, zero real SMS).
export async function sendOtp(phone: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ phone });

  if (error) {
    console.error("sendOtp failed:", error);
    return { ok: false, error: "auth.send_failed" };
  }
  return { ok: true };
}

// Verify the OTP. On success the SSR client persists the session cookie; the
// auth.users insert fires the profile-creation + first-owner triggers.
export async function verifyOtp(
  phone: string,
  code: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    phone,
    token: code,
    type: "sms",
  });

  if (error) {
    console.error("verifyOtp failed:", error);
    return { ok: false, error: "auth.verify_failed" };
  }
  return { ok: true };
}

export type SessionUser = {
  id: string;
  role: Enums<"user_role">;
  locale: Locale;
};

// Server-side session user + profile. null when signed out.
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, locale")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("getSessionUser profile fetch failed:", error);
    return null;
  }
  const locale: Locale = LOCALES.includes(profile.locale as Locale)
    ? (profile.locale as Locale)
    : DEFAULT_LOCALE;
  return { id: user.id, role: profile.role, locale };
}
