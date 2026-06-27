import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSessionUser } from "@/lib/auth/actions";
import { listDues, listSalaries, listPayments } from "@/lib/money/actions";
import {
  MoneyScreen,
  type DueRow,
  type SalaryRow,
  type LedgerRow,
} from "./money-screen";

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

  // Three independent reads for this period → run in parallel. The ledger (M4.5)
  // is the coach/owner transaction list; RLS already fails parents closed.
  const [duesRes, salariesRes, paymentsRes] = await Promise.all([
    listDues({ period }),
    listSalaries({ period }),
    listPayments({ period }),
  ]);

  const dues: DueRow[] = duesRes.ok
    ? duesRes.data.map((d) => ({
        id: d.id,
        name: d.player.full_name,
        jersey: d.player.jersey_number,
        amount: d.amount_due,
        paid: d.paid,
        remaining: d.remaining,
        credit: d.credit,
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
        credit: 0, // salaries settle via paid_at — no overpayment path
        status: s.paid_at ? "paid" : "upcoming",
      }))
    : [];

  // The transaction ledger — every logged payment this period, newest first.
  // Carries method + status + cheque number so a cheque (and a bounced one) reads
  // distinctly. Already RLS-scoped to coach/owner server-side.
  const ledger: LedgerRow[] = paymentsRes.ok
    ? paymentsRes.data.map((p) => ({
        id: p.id,
        name: p.player.full_name,
        jersey: p.player.jersey_number,
        amount: p.amount,
        method: p.method,
        status: p.status,
        chequeNumber: p.cheque_number,
        paidAt: p.paid_at,
        // Who logged it (Atlas ruling 2026-06-28) — server-set from auth.uid(),
        // embedded via recorded_by → profiles(full_name). null for legacy M4 rows
        // that predate the rule; the row's "logged by" line renders only when set.
        loggedBy: p.recorded_by?.full_name ?? null,
      }))
    : [];

  const loadError =
    duesRes.ok && salariesRes.ok && paymentsRes.ok ? null : t("load_failed");

  return (
    <MoneyScreen
      period={period}
      dues={dues}
      salaries={salaries}
      ledger={ledger}
      loadError={loadError}
    />
  );
}
