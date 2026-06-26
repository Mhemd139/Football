import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSessionUser } from "@/lib/auth/actions";
import { listDues, listSalaries } from "@/lib/money/actions";
import { MoneyScreen, type DueRow, type SalaryRow } from "./money-screen";

// /money — the M4 Money tab. Dues (kids) + Salaries (Bogrim) in two sub-tabs,
// never mixed (the DB triggers enforce the direction; the UI just shows the
// right set). Record a payment in 2 taps: tap a row → amount pre-filled to
// remaining (editable), cash default → confirm. Money chrome stays CALM (deep
// ink, not the green DNA) — product-context:104.
//
// Both lists for the current period are independent reads → run in parallel.
// Parents never reach money (coach/owner only); RLS also fails them closed.

// This month as a first-of-month ISO date (the period key generation uses).
function currentPeriod(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1))
    .toISOString()
    .slice(0, 10);
}

export default async function MoneyPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth");
  if (user.role === "parent") redirect("/");

  const t = await getTranslations("money");
  const period = currentPeriod();

  const [duesRes, salariesRes] = await Promise.all([
    listDues({ period }),
    listSalaries({ period }),
  ]);

  const dues: DueRow[] = duesRes.ok
    ? duesRes.data.map((d) => ({
        id: d.id,
        name: d.player.full_name,
        jersey: d.player.jersey_number,
        amount: d.amount_due,
        paid: d.paid,
        remaining: d.remaining,
        status: d.status,
      }))
    : [];

  // Salary status is just paid (paid_at set) or upcoming — there's no partial
  // for a salary. Remaining = full amount until it's paid.
  const salaries: SalaryRow[] = salariesRes.ok
    ? salariesRes.data.map((s) => ({
        id: s.id,
        name: s.player.full_name,
        jersey: s.player.jersey_number,
        amount: s.amount,
        paid: s.paid_at ? s.amount : 0,
        remaining: s.paid_at ? 0 : s.amount,
        status: s.paid_at ? "paid" : "upcoming",
      }))
    : [];

  const loadError = duesRes.ok && salariesRes.ok ? null : t("load_failed");

  return (
    <MoneyScreen
      period={period}
      dues={dues}
      salaries={salaries}
      loadError={loadError}
    />
  );
}
