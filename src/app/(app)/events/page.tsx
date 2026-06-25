import { getTranslations } from "next-intl/server";
import { getTodaySessions, type Event } from "@/lib/events/actions";
import { listTeams, type Category } from "@/lib/players/actions";
import { Constants } from "@/lib/supabase/types";
import { SessionsList } from "./sessions-list";

// /events — today's sessions + create-session entry. The realistic path to the
// North Star: open the app → see today's sessions → tap one → take attendance.
// (The rich calendar is M6; this is just "make a session exist + reach it".)

const CATEGORIES = Constants.public.Enums.player_category as readonly Category[];

export default async function EventsPage() {
  const t = await getTranslations("events");

  // Local-day boundary (server doesn't guess the client tz).
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  // Today's sessions + every team (the create picker spans all categories).
  const [sessionsRes, ...teamLists] = await Promise.all([
    getTodaySessions(dayStart),
    ...CATEGORIES.map((c) => listTeams(c)),
  ]);

  const teams = teamLists.flatMap((r) => (r.ok ? r.data : []));
  const teamName = new Map(teams.map((tm) => [tm.id, tm.name]));

  const sessions: Event[] = sessionsRes.ok ? sessionsRes.data : [];
  const loadError = sessionsRes.ok ? null : t(sessionsRes.error);

  return (
    <SessionsList
      sessions={sessions}
      teams={teams}
      teamName={Object.fromEntries(teamName)}
      loadError={loadError}
    />
  );
}
