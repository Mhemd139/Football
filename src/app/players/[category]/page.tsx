import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { listPlayers, type Category } from "@/lib/players/actions";
import { Constants } from "@/lib/supabase/types";
import { Roster } from "./roster";

const VALID = Constants.public.Enums.player_category;

function isCategory(value: string): value is Category {
  return (VALID as readonly string[]).includes(value);
}

export default async function CategoryRosterPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  if (!isCategory(category)) notFound();

  const t = await getTranslations("players");
  const res = await listPlayers(category);

  return (
    <Roster
      category={category}
      players={res.ok ? res.data : []}
      loadError={res.ok ? null : t(res.error)}
    />
  );
}
