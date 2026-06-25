import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSessionUser } from "@/lib/auth/actions";
import { AppShell } from "@/components/shell/app-shell";

// Wraps every signed-in screen in the app shell (desktop sidebar + mobile bottom
// nav). The proxy already gates /auth; this is the in-app guard + the data the
// shell needs (locale, role, identity).
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/auth");

  const t = await getTranslations("nav");
  const roleLabel =
    user.role === "owner" ? t("role_owner") : user.role === "parent" ? t("role_parent") : t("role_coach");

  // No display-name column yet (M1 profile = role + locale only); show the club
  // until real names land. Initial falls back to the club crest letter.
  const userName = "نادي الطيبة";
  const userInitial = "ط";

  return (
    <AppShell locale={user.locale} roleLabel={roleLabel} userName={userName} userInitial={userInitial}>
      {children}
    </AppShell>
  );
}
