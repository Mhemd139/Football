"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LOCALES, type Locale } from "@/i18n/request";

// Set the UI locale cookie (ar | he). next-intl reads this cookie on the next
// request; revalidate so server components re-render in the chosen language.
export async function setLocale(locale: Locale): Promise<void> {
  if (!LOCALES.includes(locale)) return;
  const store = await cookies();
  store.set("locale", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}
