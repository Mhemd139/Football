import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { listPlayers, listTeams, type Category } from "@/lib/players/actions";
import { Constants } from "@/lib/supabase/types";
import { Roster } from "./roster";

const VALID = Constants.public.Enums.player_category;

function isCategory(value: string): value is Category {
  return (VALID as readonly string[]).includes(value);
}

// /players/[category]/[teamId] — one team's roster. Players are scoped to the
// team (the working unit); the category in the route drives back-nav + labels.
export default async function RosterPage({
  params,
}: {
  params: Promise<{ category: string; teamId: string }>;
}) {
  const { category, teamId } = await params;
  if (!isCategory(category)) notFound();

  const t = await getTranslations("players");
  // Players + the team's name (for the header) are independent reads.
  const [playersRes, teamsRes] = await Promise.all([
    listPlayers(teamId),
    listTeams(category),
  ]);

  const team = teamsRes.ok ? teamsRes.data.find((x) => x.id === teamId) : undefined;
  if (!team) notFound();

  return (
    <Roster
      category={category}
      teamId={teamId}
      teamName={team.name}
      players={playersRes.ok ? playersRes.data : []}
      loadError={playersRes.ok ? null : t("load_failed")}
    />
  );
}
