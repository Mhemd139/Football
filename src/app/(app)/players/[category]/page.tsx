import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { listTeams, teamPlayerCounts, type Category } from "@/lib/players/actions";
import { Constants } from "@/lib/supabase/types";
import { TeamsList } from "./teams-list";

const VALID = Constants.public.Enums.player_category;

function isCategory(value: string): value is Category {
  return (VALID as readonly string[]).includes(value);
}

// /players/[category] — the teams within a category (category → team → player).
// Free-named teams the coach creates; each opens to its own roster.
export default async function TeamsPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  if (!isCategory(category)) notFound();

  const t = await getTranslations("teams");
  // Independent reads — run them together.
  const [teamsRes, countsRes] = await Promise.all([
    listTeams(category),
    teamPlayerCounts(category),
  ]);

  return (
    <TeamsList
      category={category}
      teams={teamsRes.ok ? teamsRes.data : []}
      counts={countsRes.ok ? countsRes.data : {}}
      loadError={teamsRes.ok ? null : t("load_failed")}
    />
  );
}
