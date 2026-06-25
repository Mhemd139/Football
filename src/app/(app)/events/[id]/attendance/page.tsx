import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getEvent, getEventRoster } from "@/lib/events/actions";
import { AttendanceScreen, type EventMeta } from "./attendance-screen";

// /events/[id]/attendance — the North Star. Mark a team's roster present/late/
// absent for one session. Event meta (incl. team name, one query) + the roster
// are independent reads, run in parallel.

export default async function AttendancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("attendance");

  const [eventRes, rosterRes] = await Promise.all([
    getEvent(id),
    getEventRoster(id),
  ]);

  if (!eventRes.ok) notFound();

  const event: EventMeta = {
    teamName: eventRes.data.team_name,
    title: eventRes.data.title,
    type: eventRes.data.type,
    starts_at: eventRes.data.starts_at,
    location: eventRes.data.location,
  };

  const loadError = rosterRes.ok
    ? null
    : t(rosterRes.error.startsWith("attendance.") ? rosterRes.error.slice(11) : "load_failed");

  return (
    <AttendanceScreen
      eventId={id}
      event={event}
      roster={rosterRes.ok ? rosterRes.data : []}
      loadError={loadError}
    />
  );
}
