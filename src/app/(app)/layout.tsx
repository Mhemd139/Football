import { redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { getSessionUser } from "@/lib/auth/actions";
import { AppShell } from "@/components/shell/app-shell";
import type { Locale } from "@/i18n/request";

// Wraps every signed-in screen in the app shell (desktop sidebar + mobile bottom
// nav). The proxy already gates /auth; this is the in-app guard + the data the
// shell needs (locale, role, identity).
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/auth");

  // The ACTIVE locale = the cookie next-intl renders from (what setLocale writes),
  // NOT user.locale (the profile column, which the toggle doesn't update). Using
  // the profile value made the toggle highlight the wrong language and its
  // same-value guard block switching back. The cookie is the single source of truth.
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("nav");
  const roleLabel =
    user.role === "owner" ? t("role_owner") : user.role === "parent" ? t("role_parent") : t("role_coach");

  // No display-name column yet (M1 profile = role + locale only); show the club
  // until real names land. Initial falls back to the club crest letter.
  const userName = "نادي الطيبة";
  const userInitial = "ط";

  return (
    <AppShell locale={locale} roleLabel={roleLabel} userName={userName} userInitial={userInitial}>
      {children}
    </AppShell>
  );
}
