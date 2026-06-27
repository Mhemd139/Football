"use client";

import { useState, useMemo, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  recordPayment,
  generateDues,
  generateSalaries,
  findPaymentByChequeNumber,
  markChequeBounced,
  type DueStatus,
  type PaymentMethod,
  type PaymentStatus,
} from "@/lib/money/actions";
import {
  AnimatePresence,
  BottomSheet,
  FadeUp,
} from "@/components/motion/primitives";
import { SuccessCheck } from "@/components/motion/success-check";

// The Money tab: Dues (kids) + Salaries (Bogrim), never mixed. Dues are payable
// in 2 taps (tap row → amount pre-filled to remaining, editable, cash default →
// confirm). Salaries are read-only here — the live contract has no salary-payment
// action (a salary is settled by paid_at, no recordPayment path), so a salary row
// shows its status but doesn't open the payment sheet. Status = color + LABEL,
// never color alone. Calm deep-ink chrome (product-context:104), not green DNA.

export type DueRow = {
  id: string;
  name: string;
  jersey: number | null;
  amount: number;
  paid: number;
  remaining: number;
  // Surplus when the coach overpaid (cash-at-pitch). Shown explicitly as a credit
  // line — never a bare negative remaining (Atlas ruling, product-context:104).
  credit: number;
  status: DueStatus;
};

// Salaries reuse the same row shape but only ever carry paid/upcoming status.
export type SalaryRow = DueRow;

// A logged payment as the ledger renders it (M4.5). Carries method + payment
// status + cheque number so a cheque, and a bounced one, reads distinctly.
// `loggedBy` = the staff member who recorded it (Atlas ruling 2026-06-28) — null
// for legacy M4 rows (predate the rule) and until Sweeper lands the embed; the
// "logged by" line renders only when it's present (never a fake "unknown").
export type LedgerRow = {
  id: string;
  name: string;
  jersey: number | null;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  chequeNumber: string | null;
  paidAt: string;
  loggedBy: string | null;
};

type Tab = "dues" | "salaries" | "ledger";
type Filter = "all" | DueStatus;

// The fields a recorded payment recomputes — overlaid onto a due row optimistically.
type Balance = { paid: number; remaining: number; credit: number; status: DueStatus };

const FILTERS: Filter[] = ["all", "overdue", "partial", "upcoming", "paid"];

// Status pill colors — color + label, never color alone (a11y). Matches the
// reserved semantics: paid green / partial amber / overdue red / upcoming blue.
// `lit` ties each status to a floodlit tile tone, so the row's monogram tile
// IS the status colour — financial status reads at a glance the way the roster
// reads positionally, while the label still spells it out (never colour alone).
const PILL: Record<
  DueStatus,
  { bg: string; fg: string; dot: string; lit: "green" | "gold" | "red" | "blue" }
> = {
  paid: { bg: "#E7F8F0", fg: "#047857", dot: "#10B981", lit: "green" },
  partial: { bg: "#FEF3E2", fg: "#B45309", dot: "#F59E0B", lit: "gold" },
  overdue: { bg: "#FDECEA", fg: "#C0392B", dot: "#EF4444", lit: "red" },
  upcoming: { bg: "#EAF0FB", fg: "#2563EB", dot: "#60A5FA", lit: "blue" },
  // Overpaid = paid + a credit (Atlas ruling). Paid-green FAMILY so it reads as
  // settled, but a deeper teal (not the plain-paid mint) + its own label + an
  // explicit credit line make it unmistakable from a plain `paid` at a glance.
  overpaid: { bg: "#D7F1EA", fg: "#0F6E5A", dot: "#0D9488", lit: "green" },
};

// Payment-status pill (ledger, M4.5) — color + LABEL, never color alone. A
// bounced cheque gets its OWN distinct treatment (deep red-violet, not the plain
// overdue red) so it never reads as a normal unpaid row (plan:539); cleared =
// green (counted), pending = amber (a cheque not yet cleared).
const PAYMENT_PILL: Record<PaymentStatus, { bg: string; fg: string; dot: string }> = {
  cleared: { bg: "#E7F8F0", fg: "#047857", dot: "#10B981" },
  pending: { bg: "#FEF3E2", fg: "#B45309", dot: "#F59E0B" },
  bounced: { bg: "#FBE9F0", fg: "#9D174D", dot: "#DB2777" },
};

// Western numerals even in the Arabic UI, with thousands grouping — the club
// reads 3,500, not ٣٬٥٠٠ (owner ruling). Numerals live in .num spans (LTR-isolated).
const fmt = (n: number) => n.toLocaleString("en-US");

// Method → its i18n label. 3-way (cash | transfer | cheque) so a cheque never
// mislabels as "transfer" (the binary fallback Sweeper flagged at the old line 644).
const methodLabel = (
  method: PaymentMethod,
  t: ReturnType<typeof useTranslations<"money">>,
) => t(`method_${method}`);

export function MoneyScreen({
  period,
  dues,
  salaries,
  ledger,
  loadError,
}: {
  period: string;
  dues: DueRow[];
  salaries: SalaryRow[];
  ledger: LedgerRow[];
  loadError: string | null;
}) {
  const t = useTranslations("money");
  const tLedger = useTranslations("ledger");
  // Root translator for the cross-namespace error keys the actions return
  // (e.g. "dues.save_failed", "payments.save_failed") — show the real reason,
  // never a generic swallow.
  const tRoot = useTranslations();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("dues");
  const [filter, setFilter] = useState<Filter>("all");
  // Dues render from the server prop, with an optimistic overlay keyed by due id
  // so a just-recorded payment shows instantly (before router.refresh lands the
  // authoritative row). Salaries are read-only here (no payment path in the
  // contract), so they render straight from prop.
  const [paid, setPaid] = useState<Record<string, Balance>>({});
  // Apply an overlay ONLY while the server row hasn't caught up to it (server
  // `paid` < optimistic `paid`). Once the refresh lands the authoritative row,
  // the overlay is stale and ignored — the server row wins. Deriving this in the
  // memo (not an effect that prunes state) keeps the overlay transient without a
  // setState-in-effect; a leftover stale key in `paid` is harmless, never applied.
  const dueRows = useMemo(
    () =>
      dues.map((r) => {
        const o = paid[r.id];
        return o && r.paid < o.paid ? { ...r, ...o } : r;
      }),
    [dues, paid],
  );
  const salaryRows = salaries;
  const [paying, setPaying] = useState<DueRow | null>(null);
  const [success, setSuccess] = useState<{
    name: string;
    method: PaymentMethod;
    paid: number;
    remaining: number;
    credit: number;
    offline: boolean;
  } | null>(null);
  const [genMsg, setGenMsg] = useState<string | null>(null);
  const [genBusy, setGenBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const rows = tab === "salaries" ? salaryRows : dueRows;

  const shown = useMemo(
    () => (filter === "all" ? rows : rows.filter((r) => r.status === filter)),
    [rows, filter],
  );

  // Header hero stat. Dues/salaries → still-owed total. Ledger → total actually
  // collected (cleared payments only; a pending/bounced cheque hasn't paid).
  const summary = useMemo(() => {
    if (tab === "ledger") {
      return ledger
        .filter((p) => p.status === "cleared")
        .reduce((s, p) => s + p.amount, 0);
    }
    return rows.reduce((s, r) => s + r.remaining, 0);
  }, [tab, ledger, rows]);

  const switchTab = (next: Tab) => {
    setTab(next);
    setFilter("all");
    setGenMsg(null);
    setActionError(null);
  };

  // Generate this month's rows (idempotent on the server). Dues only generate
  // a payable list; salaries generate the owed list. Skipped count surfaces the
  // Bogrim with no salary set (honest, never zeroed).
  const onGenerate = useCallback(async () => {
    if (genBusy) return;
    setGenBusy(true);
    setActionError(null);
    const res =
      tab === "dues"
        ? await generateDues(period)
        : await generateSalaries(period);
    setGenBusy(false);
    if (!res.ok) {
      setActionError(tRoot(res.error));
      return;
    }
    setGenMsg(
      res.data.skipped > 0
        ? t("generated_skipped", {
            created: fmt(res.data.created),
            skipped: fmt(res.data.skipped),
          })
        : t("generated", { created: fmt(res.data.created) }),
    );
    // The new rows need a server re-read to appear; refresh the route data.
    router.refresh();
  }, [genBusy, tab, period, t, tRoot, router]);

  const onConfirm = useCallback(
    async (amount: number, method: PaymentMethod, chequeNumber?: string) => {
      if (!paying) return;
      const row = paying;
      setPaying(null);
      const clientId = crypto.randomUUID();
      const res = await recordPayment({
        dueId: row.id,
        amount,
        method,
        clientId,
        chequeNumber,
      });
      if (!res.ok) {
        setActionError(tRoot(res.error));
        return;
      }
      // Overlay the server-recomputed balance on the row (drops once a refresh
      // lands the matching server row).
      setPaid((prev) => ({
        ...prev,
        [row.id]: {
          paid: res.data.paid,
          remaining: res.data.remaining,
          credit: res.data.credit,
          status: res.data.status,
        },
      }));
      setSuccess({
        name: row.name,
        method,
        paid: res.data.paid,
        remaining: res.data.remaining,
        credit: res.data.credit,
        offline: false,
      });
    },
    [paying, tRoot],
  );

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col bg-[#F4F7FB]" dir="rtl">
      {/* ── ALIVE header — the green→blue DNA band (owner: "more alive, more
         energetic"). Money rides the same signature as Home/roster: crest +
         glass tiles + the hero stat as a frosted chip. ── */}
      <header className="pitch-band pitch-band--home px-5 pb-5 pt-7 lg:rounded-b-[28px]">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label={t("cancel")}
            className="-m-1.5 grid h-11 w-11 flex-none place-items-center rounded-xl bg-white/[0.16] text-white ring-1 ring-white/[0.28] backdrop-blur-sm transition-colors hover:bg-white/[0.24]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
          <span aria-hidden className="pitch-tile grid h-[46px] w-[46px] flex-none place-items-center rounded-2xl">
            <Image src="/assets/tfc-crest-circle.png" alt="" width={28} height={28} className="object-contain" />
          </span>
          <h1 className="flex-1 text-[19px] font-bold tracking-tight text-white">{t("title")}</h1>
          <span className="whitespace-nowrap rounded-full bg-white/[0.16] px-3 py-1.5 text-[11.5px] font-semibold text-white ring-1 ring-white/[0.24] backdrop-blur-sm">
            {formatPeriod(period)}
          </span>
        </div>

        {/* hero stat — the month total as a frosted glass chip (DNA #7) */}
        <div className="stat-glass mt-4 flex items-end justify-between gap-3 rounded-2xl px-4 py-3.5">
          <div>
            <span className="text-[12px] font-semibold text-white/85">
              {tab === "ledger"
                ? t("summary_collected")
                : tab === "dues"
                  ? t("summary_dues")
                  : t("summary_salaries")}
            </span>
            <span className="mt-1 block text-[32px] font-bold leading-none text-white">
              <span className="num drop-shadow-[0_1px_2px_rgba(11,26,46,0.25)]">{fmt(summary)}</span>
              <span className="ms-1.5 text-[15px] font-semibold text-white/75">{t("currency")}</span>
            </span>
          </div>
          <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-white/[0.18] text-[22px] font-bold leading-none text-white ring-1 ring-white/[0.26]" aria-hidden="true">
            {t("currency")}
          </span>
        </div>

        {/* sub-tabs — glass segmented control on the band */}
        <div className="mt-4 flex gap-1.5 rounded-2xl bg-white/[0.12] p-1 ring-1 ring-white/[0.18]">
          <TabButton
            label={t("tab_dues")}
            sub={t("tab_dues_sub")}
            on={tab === "dues"}
            onClick={() => switchTab("dues")}
          />
          <TabButton
            label={t("tab_salaries")}
            sub={t("tab_salaries_sub")}
            on={tab === "salaries"}
            onClick={() => switchTab("salaries")}
          />
          <TabButton
            label={tLedger("tab_label")}
            sub={tLedger("title")}
            on={tab === "ledger"}
            onClick={() => switchTab("ledger")}
          />
        </div>
      </header>

      {tab === "ledger" ? (
        <TransactionLedger
          rows={ledger}
          period={period}
          loadError={loadError}
          onRetry={() => router.refresh()}
          onBounced={() => router.refresh()}
          t={tLedger}
          tMoney={t}
        />
      ) : (
        <>
          {/* ── toolbar: filters + generate ── */}
          <div className="flex items-center gap-2 px-4 pb-1.5 pt-3">
            <div className="flex flex-1 gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[11.5px] font-semibold transition active:scale-95 ${
                    filter === f
                      ? "border-transparent bg-[#2563EB] text-white shadow-[0_4px_12px_rgba(37,99,235,0.28)]"
                      : "border-[#E3EAF1] bg-white text-[#51637A] hover:border-[#CBD7E3]"
                  }`}
                >
                  {t(`filter_${f}`)}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={onGenerate}
              disabled={genBusy}
              className="flex h-8 flex-none items-center gap-1.5 rounded-full px-3.5 text-[11.5px] font-bold text-white shadow-[0_6px_16px_rgba(16,135,120,0.32)] transition active:scale-95 disabled:opacity-60"
              style={{ background: "linear-gradient(150deg,#34d399 0%,#10b981 45%,#047857 100%)" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
              {t("generate")}
            </button>
          </div>

          {(genMsg || actionError) && (
            <p
              className={`mx-4 mb-1 rounded-xl px-3 py-2 text-[12px] font-semibold ${
                actionError ? "bg-[#FDECEA] text-[#C0392B]" : "bg-[#E7F8F0] text-[#047857]"
              }`}
              role="status"
            >
              {actionError ?? genMsg}
            </p>
          )}

          {/* ── list ── */}
          <div className="flex-1 overflow-y-auto px-4 pb-6 pt-1.5">
            {loadError ? (
              <ErrorState message={loadError} onRetry={() => router.refresh()} retry={t("retry")} />
            ) : shown.length === 0 ? (
              <EmptyState
                title={tab === "dues" ? t("empty_dues_title") : t("empty_salaries_title")}
                body={t("empty_body")}
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {shown.map((r, i) => (
                  <MoneyRow
                    key={r.id}
                    row={r}
                    index={i}
                    payable={tab === "dues" && r.remaining > 0}
                    onPay={() => setPaying(r)}
                    t={t}
                  />
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {/* ── record-payment sheet (dues only) ── */}
      <AnimatePresence>
        {paying && (
          <PaymentSheet
            row={paying}
            onClose={() => setPaying(null)}
            onConfirm={onConfirm}
            t={t}
          />
        )}
      </AnimatePresence>

      {/* ── success overlay ── */}
      <AnimatePresence>
        {success && (
          <SuccessOverlay
            data={success}
            onDone={() => setSuccess(null)}
            t={t}
          />
        )}
      </AnimatePresence>
    </main>
  );
}

function TabButton({
  label,
  sub,
  on,
  onClick,
}: {
  label: string;
  sub: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-xl px-1.5 py-2 text-center text-[13.5px] font-bold transition ${
        on
          ? "bg-white text-[#0E2647] shadow-[0_4px_12px_rgba(11,26,46,0.18)]"
          : "text-white/70 hover:text-white/90"
      }`}
    >
      {label}
      <span className={`mt-0.5 block text-[9.5px] font-semibold ${on ? "text-[#5E6E80]" : "opacity-65"}`}>{sub}</span>
    </button>
  );
}

function MoneyRow({
  row,
  index,
  payable,
  onPay,
  t,
}: {
  row: DueRow;
  index: number;
  payable: boolean;
  onPay: () => void;
  t: ReturnType<typeof useTranslations<"money">>;
}) {
  const pill = PILL[row.status];
  const initial = row.name.trim()[0] ?? "؟";
  const paidInFull = row.remaining === 0;
  // The floodlit tile shows the jersey when there is one (the team-sheet read),
  // and falls back to the name initial — but it is always toned by status, so
  // the colour of the tile IS the money status before any text is read.
  const tile = row.jersey != null ? fmt(row.jersey) : initial;

  const inner = (
    <>
      {/* status leading edge — a 3px colour stripe, the alive-card's lit spine */}
      <span className="absolute inset-y-0 start-0 w-[3px]" style={{ background: pill.dot }} aria-hidden="true" />
      <span className={`floodlit floodlit--${pill.lit} h-[46px] w-[46px] flex-none text-[16px] font-bold`}>
        <span className="num drop-shadow-[0_1px_1px_rgba(11,26,46,0.25)]">{tile}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold tracking-tight text-[#0B1A2E]">{row.name}</span>
        <span className="mt-0.5 block text-[11px] text-[#5E6E80]">
          {t("row_value")} <span className="num">{fmt(row.amount)}</span> {t("currency")}
        </span>
      </span>
      <span className="flex flex-none flex-col items-end gap-1">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-bold"
          style={{ background: pill.bg, color: pill.fg }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: pill.dot }} aria-hidden="true" />
          {t(`status_${row.status}`)}
        </span>
        <span
          className="text-[12.5px] font-bold"
          style={{ color: row.status === "overpaid" ? "#0F6E5A" : paidInFull ? "#047857" : row.status === "overdue" ? "#C0392B" : "#0B1A2E" }}
        >
          {row.status === "overpaid" ? (
            // Credit, not a bare negative — Atlas ruling: paid AND the surplus shown.
            <>
              <span className="me-1 text-[9px] font-semibold text-[#0F6E5A]/70">{t("credit_label")}</span>
              <span className="num">{fmt(row.credit)}</span> {t("currency")}
            </>
          ) : paidInFull ? (
            t("paid_in_full")
          ) : (
            <>
              <span className="me-1 text-[9px] font-semibold text-[#5E6E80]">{t("remaining")}</span>
              <span className="num">{fmt(row.remaining)}</span> {t("currency")}
            </>
          )}
        </span>
      </span>
    </>
  );

  const base = "alive-card relative flex w-full items-center gap-3 overflow-hidden p-3 text-start";

  return (
    <li>
      <FadeUp delay={Math.min(index * 0.03, 0.18)}>
        {payable ? (
          <button type="button" onClick={onPay} className={base}>
            {inner}
            <svg className="-ms-1 flex-none text-[#9AA9B8]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
        ) : (
          <div className={base}>{inner}</div>
        )}
      </FadeUp>
    </li>
  );
}

// ── Transaction ledger (M4.5) ───────────────────────────────────────────────
// Every logged payment, newest first. Search is by CHEQUE NUMBER first — when a
// cheque bounces the bank returns only its number, and the owner recovers who
// gave it by punching that number in (plan:535-536). A cheque row offers
// "mark bounced" → confirm modal → the linked due reopens.

type LedgerTr = ReturnType<typeof useTranslations<"ledger">>;
type MoneyTr = ReturnType<typeof useTranslations<"money">>;

function TransactionLedger({
  rows,
  period,
  loadError,
  onRetry,
  onBounced,
  t,
  tMoney,
}: {
  rows: LedgerRow[];
  period: string;
  loadError: string | null;
  onRetry: () => void;
  onBounced: () => void;
  t: LedgerTr;
  tMoney: MoneyTr;
}) {
  const tRoot = useTranslations();
  const [query, setQuery] = useState("");
  // undefined = not yet searched; null = searched, no match; object = the match.
  const [match, setMatch] = useState<LedgerRow | null | undefined>(undefined);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  // The cheque row awaiting a bounce confirm, and the post-action status line.
  const [bounceTarget, setBounceTarget] = useState<LedgerRow | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const runSearch = useCallback(async () => {
    const number = query.trim();
    if (!number || searching) return;
    setSearching(true);
    setSearchError(null);
    setStatusMsg(null);
    const res = await findPaymentByChequeNumber(number);
    setSearching(false);
    if (!res.ok) {
      setSearchError(tRoot(res.error));
      return;
    }
    setMatch(
      res.data
        ? {
            id: res.data.id,
            name: res.data.player.full_name,
            jersey: res.data.player.jersey_number,
            amount: res.data.amount,
            method: res.data.method,
            status: res.data.status,
            chequeNumber: res.data.cheque_number,
            paidAt: res.data.paid_at,
            loggedBy: res.data.recorded_by?.full_name ?? null,
          }
        : null,
    );
  }, [query, searching, tRoot]);

  const clearSearch = () => {
    setQuery("");
    setMatch(undefined);
    setSearchError(null);
  };

  const onBounce = useCallback(
    async (row: LedgerRow) => {
      setBounceTarget(null);
      const res = await markChequeBounced(row.id);
      if (!res.ok) {
        setStatusMsg(tRoot(res.error));
        return;
      }
      setStatusMsg(t("bounced_done"));
      // The match view, if showing this cheque, now reflects bounced too.
      setMatch((m) => (m && m.id === row.id ? { ...m, status: "bounced" } : m));
      onBounced();
    },
    [t, tRoot, onBounced],
  );

  return (
    <>
      {/* search-by-cheque-number — the primary reconciliation path */}
      <div className="px-4 pb-1.5 pt-3">
        <div className="flex items-center gap-2 rounded-2xl border border-[#E3EAF1] bg-white px-3 py-2 focus-within:border-[#60A5FA]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9AA9B8" strokeWidth="2" aria-hidden="true" className="flex-none">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4-4" />
          </svg>
          <input
            type="text"
            inputMode="numeric"
            dir="ltr"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (match !== undefined) setMatch(undefined);
              if (searchError) setSearchError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") runSearch();
            }}
            placeholder={t("search_placeholder")}
            aria-label={t("search_by_cheque")}
            className="num min-w-0 flex-1 bg-transparent text-start text-[14px] font-semibold text-[#0B1A2E] outline-none placeholder:font-normal placeholder:text-[#9AA9B8]"
          />
          {query.trim() && (
            <button
              type="button"
              onClick={runSearch}
              disabled={searching}
              className="flex-none rounded-full bg-[#2563EB] px-3 py-1 text-[11.5px] font-bold text-white transition active:scale-95 disabled:opacity-60"
            >
              {t("search_by_cheque")}
            </button>
          )}
        </div>
      </div>

      {(statusMsg || searchError) && (
        <p
          className={`mx-4 mb-1 rounded-xl px-3 py-2 text-[12px] font-semibold ${
            searchError ? "bg-[#FDECEA] text-[#C0392B]" : "bg-[#E7F8F0] text-[#047857]"
          }`}
          role="status"
        >
          {searchError ?? statusMsg}
        </p>
      )}

      <div className="flex-1 overflow-y-auto px-4 pb-6 pt-1.5">
        {loadError ? (
          <ErrorState message={loadError} onRetry={onRetry} retry={t("retry")} />
        ) : match !== undefined ? (
          // ── search result view ──
          <div>
            <button
              type="button"
              onClick={clearSearch}
              className="mb-2 inline-flex items-center gap-1 text-[12px] font-semibold text-[#2563EB]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                <path d="M9 6l6 6-6 6" />
              </svg>
              {t("title")}
            </button>
            {match === null ? (
              <EmptyState title={t("cheque_no_match")} body={t("empty_body")} />
            ) : (
              <>
                <p className="mb-1 text-[12px] font-semibold text-[#5E6E80]">{t("cheque_match_title")}</p>
                <p className="mb-2.5 text-[11px] text-[#9AA9B8]">
                  {t("cheque_match_hint", { number: match.chequeNumber ?? "" })}
                </p>
                <ul className="flex flex-col gap-2">
                  <LedgerPaymentRow
                    row={match}
                    index={0}
                    onBounce={() => setBounceTarget(match)}
                    t={t}
                    tMoney={tMoney}
                  />
                </ul>
              </>
            )}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState title={t("empty_title")} body={t("empty_body")} />
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((r, i) => (
              <LedgerPaymentRow
                key={r.id}
                row={r}
                index={i}
                onBounce={() => setBounceTarget(r)}
                t={t}
                tMoney={tMoney}
              />
            ))}
          </ul>
        )}
        <p className="mt-3 text-center text-[10.5px] text-[#9AA9B8]">{formatPeriod(period)}</p>
      </div>

      {/* mark-bounced confirm — destructive, so a modal (spec: modals for
         destructive/one-time only) */}
      <AnimatePresence>
        {bounceTarget && (
          <BounceConfirm
            row={bounceTarget}
            onClose={() => setBounceTarget(null)}
            onConfirm={() => onBounce(bounceTarget)}
            t={t}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function LedgerPaymentRow({
  row,
  index,
  onBounce,
  t,
  tMoney,
}: {
  row: LedgerRow;
  index: number;
  onBounce: () => void;
  t: LedgerTr;
  tMoney: MoneyTr;
}) {
  const pill = PAYMENT_PILL[row.status];
  const initial = row.name.trim()[0] ?? "؟";
  const tile = row.jersey != null ? fmt(row.jersey) : initial;
  // Only a cheque that hasn't already bounced can be marked bounced.
  const canBounce = row.method === "cheque" && row.status !== "bounced";

  return (
    <li>
      <FadeUp delay={Math.min(index * 0.03, 0.18)}>
        <div className="alive-card relative flex w-full items-center gap-3 overflow-hidden p-3 text-start">
          <span className="absolute inset-y-0 start-0 w-[3px]" style={{ background: pill.dot }} aria-hidden="true" />
          <span className="grid h-[46px] w-[46px] flex-none place-items-center rounded-2xl bg-[#EEF3F8] text-[15px] font-bold text-[#0B1A2E]">
            <span className="num">{tile}</span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold tracking-tight text-[#0B1A2E]">{row.name}</span>
            <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[#5E6E80]">
              <span>{methodLabel(row.method, tMoney)}</span>
              {row.chequeNumber && (
                <span className="text-[#9AA9B8]">
                  #<span className="num">{row.chequeNumber}</span>
                </span>
              )}
              <span className="text-[#9AA9B8]">{formatDate(row.paidAt)}</span>
            </span>
            {/* who recorded it (Atlas ruling) — only when known; never a fake "unknown" */}
            {row.loggedBy && (
              <span className="mt-0.5 block text-[10.5px] text-[#9AA9B8]">
                {t("logged_by", { name: row.loggedBy })}
              </span>
            )}
          </span>
          <span className="flex flex-none flex-col items-end gap-1.5">
            <span className="text-[13px] font-bold text-[#0B1A2E]">
              <span className="num">{fmt(row.amount)}</span> {tMoney("currency")}
            </span>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-bold"
              style={{ background: pill.bg, color: pill.fg }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: pill.dot }} aria-hidden="true" />
              {tMoney(`status_${row.status}`)}
            </span>
            {canBounce && (
              <button
                type="button"
                onClick={onBounce}
                className="-me-1 inline-flex min-h-[44px] items-center rounded-full px-3 py-1 text-[10.5px] font-bold text-[#9D174D] transition active:scale-95"
              >
                <span className="rounded-full border border-[#F4C2D6] bg-white px-2.5 py-1">
                  {t("mark_bounced")}
                </span>
              </button>
            )}
          </span>
        </div>
      </FadeUp>
    </li>
  );
}

function BounceConfirm({
  row,
  onClose,
  onConfirm,
  t,
}: {
  row: LedgerRow;
  onClose: () => void;
  onConfirm: () => void;
  t: LedgerTr;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <BottomSheet onClose={onClose} label={t("mark_bounced")}>
      <div className="rounded-t-[22px] bg-white px-[18px] pb-[max(18px,env(safe-area-inset-bottom))] pt-[18px]">
        <div className="mx-auto mb-3.5 h-1 w-9 rounded-full bg-[#DDE5EC]" />
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-[#FBE9F0] text-[#9D174D]">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <path d="M12 9v4M12 17h.01" />
            <circle cx="12" cy="12" r="9" />
          </svg>
        </div>
        <h3 className="text-center text-[16px] font-bold text-[#0B1A2E]">
          {t("mark_bounced_title", { name: row.name })}
        </h3>
        <p className="mx-auto mt-1.5 max-w-[280px] text-center text-[12.5px] leading-relaxed text-[#5E6E80]">
          {t("mark_bounced_body")}
        </p>
        <button
          type="button"
          onClick={() => {
            if (busy) return;
            setBusy(true);
            onConfirm();
          }}
          disabled={busy}
          className="mt-4 flex h-[52px] w-full items-center justify-center rounded-2xl bg-[#9D174D] text-[15px] font-bold text-white shadow-[0_8px_20px_rgba(157,23,77,0.28)] transition active:scale-[0.98] disabled:opacity-60"
        >
          {t("mark_bounced_confirm")}
        </button>
        <button type="button" onClick={onClose} className="mt-2.5 w-full text-center text-[12px] text-[#5E6E80]">
          {t("cancel")}
        </button>
      </div>
    </BottomSheet>
  );
}

function PaymentSheet({
  row,
  onClose,
  onConfirm,
  t,
}: {
  row: DueRow;
  onClose: () => void;
  onConfirm: (amount: number, method: PaymentMethod, chequeNumber?: string) => void;
  t: ReturnType<typeof useTranslations<"money">>;
}) {
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState<number>(row.remaining);
  // Cheque number — required the moment method is cheque (the bank traces a
  // bounced cheque back to its player by this number; the DB CHECK enforces it
  // too, we just block early for a clean error). Meaningless for cash/transfer.
  const [chequeNumber, setChequeNumber] = useState("");
  const [chequeError, setChequeError] = useState(false);
  const [busy, setBusy] = useState(false);
  const initial = row.name.trim()[0] ?? "؟";
  // The sheet only opens on a payable due (partial / overdue), so its floodlit
  // tile carries that same status tone — the row you tapped stays recognisable.
  const lit = PILL[row.status].lit;
  const tile = row.jersey != null ? fmt(row.jersey) : initial;
  const isCheque = method === "cheque";

  const pickMethod = (next: PaymentMethod) => {
    setMethod(next);
    if (next !== "cheque") setChequeError(false);
  };

  const confirm = () => {
    const amt = editing ? amount : row.remaining;
    if (!(amt > 0) || busy) return;
    const number = chequeNumber.trim();
    if (isCheque && !number) {
      setChequeError(true);
      return;
    }
    setBusy(true);
    onConfirm(amt, method, isCheque ? number : undefined);
  };

  return (
    <BottomSheet onClose={onClose} label={t("record_payment")}>
      <div className="rounded-t-[22px] bg-white px-[18px] pb-[max(18px,env(safe-area-inset-bottom))] pt-[18px]">
        <div className="mx-auto mb-3.5 h-1 w-9 rounded-full bg-[#DDE5EC]" />

        <div className="flex items-center gap-3">
          <span className={`floodlit floodlit--${lit} h-[46px] w-[46px] flex-none text-[16px] font-bold`}>
            <span className="num drop-shadow-[0_1px_1px_rgba(11,26,46,0.25)]">{tile}</span>
          </span>
          <div className="min-w-0">
            <h3 className="text-[16px] font-bold text-[#0B1A2E]">{row.name}</h3>
            <p className="mt-px text-[11.5px] text-[#5E6E80]">{t("record_payment")}</p>
          </div>
        </div>

        {/* amount — pre-filled to remaining, editable (rare path) */}
        <div className="mt-4 rounded-2xl border border-[#E3EAF1] bg-[#F4F7FB] p-3.5 text-center">
          <div className="text-[11px] font-semibold text-[#5E6E80]">{t("amount_label")}</div>
          {editing ? (
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={amount}
              onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
              autoFocus
              aria-label={t("amount_label")}
              className="num mt-2 w-36 rounded-xl border-[1.5px] border-[#60A5FA] px-2.5 py-1.5 text-center text-[22px] font-bold text-[#0B1A2E] outline-none"
            />
          ) : (
            <>
              <div className="mt-1 text-[34px] font-bold text-[#0B1A2E]">
                <span className="num">{fmt(row.remaining)}</span>
                <span className="ms-1 text-[16px] font-semibold text-[#5E6E80]">{t("currency")}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditing(true);
                  setAmount(row.remaining);
                }}
                className="mt-2 text-[11px] font-semibold text-[#2563EB]"
              >
                {t("amount_edit")}
              </button>
            </>
          )}
        </div>

        {/* method — cash default, transfer + cheque optional */}
        <div className="mb-1.5 ms-0.5 mt-3.5 text-[11.5px] font-semibold text-[#5E6E80]">{t("method_label")}</div>
        <div className="flex gap-2">
          <MethodChip
            label={t("method_cash")}
            on={method === "cash"}
            onClick={() => pickMethod("cash")}
            icon={
              <>
                <rect x="2" y="6" width="20" height="12" rx="2" />
                <circle cx="12" cy="12" r="2.5" />
              </>
            }
          />
          <MethodChip
            label={t("method_transfer")}
            on={method === "transfer"}
            onClick={() => pickMethod("transfer")}
            icon={<path d="M4 12h16M14 6l6 6-6 6" />}
          />
          <MethodChip
            label={t("method_cheque")}
            on={isCheque}
            onClick={() => pickMethod("cheque")}
            icon={
              <>
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <path d="M2 10h20M6 15h6" />
              </>
            }
          />
        </div>

        {/* cheque number — required when cheque is the method (the bank traces a
           bounced cheque back to its player by this number). Numerals LTR-isolated. */}
        {isCheque && (
          <div className="mt-3">
            <label htmlFor="cheque-number" className="mb-1.5 ms-0.5 block text-[11.5px] font-semibold text-[#5E6E80]">
              {t("cheque_number_label")}
            </label>
            <input
              id="cheque-number"
              type="text"
              inputMode="numeric"
              dir="ltr"
              value={chequeNumber}
              onChange={(e) => {
                setChequeNumber(e.target.value);
                if (chequeError) setChequeError(false);
              }}
              autoFocus
              placeholder={t("cheque_number_placeholder")}
              aria-invalid={chequeError}
              className={`num w-full rounded-2xl border-[1.5px] bg-[#F4F7FB] px-3.5 py-3 text-start text-[16px] font-semibold text-[#0B1A2E] outline-none transition placeholder:font-normal placeholder:text-[#9AA9B8] ${
                chequeError ? "border-[#EF4444]" : "border-[#E3EAF1] focus:border-[#60A5FA]"
              }`}
            />
            {chequeError && (
              <p className="mt-1.5 ms-0.5 text-[11px] font-semibold text-[#C0392B]" role="alert">
                {t("cheque_number_required")}
              </p>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={confirm}
          disabled={busy}
          className="mt-4 flex h-[52px] w-full items-center justify-center gap-2.5 rounded-2xl bg-[#047857] text-[15px] font-bold text-white shadow-[0_8px_20px_rgba(4,120,87,0.28)] transition active:scale-[0.98] disabled:opacity-60"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" aria-hidden="true">
            <path d="M4 12l5 5L20 6" />
          </svg>
          {t("confirm_payment")} <span className="num">{fmt(editing ? amount : row.remaining)}</span> {t("currency")}
        </button>
        <button type="button" onClick={onClose} className="mt-2.5 w-full text-center text-[12px] text-[#5E6E80]">
          {t("cancel")}
        </button>
      </div>
    </BottomSheet>
  );
}

function MethodChip({
  label,
  on,
  onClick,
  icon,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-[13px] border-[1.5px] p-2.5 text-[13px] font-semibold transition ${
        on ? "border-[#10B981] bg-[#E7F8F0] text-[#047857]" : "border-[#E3EAF1] bg-white text-[#51637A]"
      }`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        {icon}
      </svg>
      {label}
    </button>
  );
}

function SuccessOverlay({
  data,
  onDone,
  t,
}: {
  data: { name: string; method: PaymentMethod; paid: number; remaining: number; credit: number; offline: boolean };
  onDone: () => void;
  t: ReturnType<typeof useTranslations<"money">>;
}) {
  const overpaid = data.credit > 0;
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-8 text-center"
      style={{ background: "linear-gradient(170deg,#ECFBF3 0%,#F4F8FF 100%)" }}
    >
      <SuccessCheck size={96} />
      <h2 className="mt-5 text-[21px] font-bold text-[#0B1A2E]" role="status">
        {data.offline ? t("success_offline_title") : t("success_title")}
      </h2>
      <p className="mt-1 text-[12.5px] text-[#5E6E80]">
        {data.name} · {methodLabel(data.method, t)}
      </p>
      {data.offline && (
        <p className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-[#FEF3E2] px-3 py-1.5 text-[11.5px] font-semibold text-[#B45309]">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <path d="M21 12a9 9 0 11-3-6.7M21 3v6h-6" />
          </svg>
          {t("success_offline")}
        </p>
      )}
      <div className="mt-5 flex gap-2.5">
        <SuccessStat n={data.paid} label={t("success_paid")} color="#047857" />
        {overpaid ? (
          // Overpaid → the second stat is the explicit credit, not a 0 remaining.
          <SuccessStat n={data.credit} label={t("credit_label")} color="#0F6E5A" />
        ) : (
          <SuccessStat
            n={data.remaining}
            label={t("success_remaining")}
            color={data.remaining === 0 ? "#047857" : "#C0392B"}
          />
        )}
      </div>
      <button
        type="button"
        onClick={onDone}
        className="mt-6 h-12 w-full max-w-[220px] rounded-2xl bg-[#0B1A2E] text-[14px] font-bold text-white"
      >
        {t("success_done")}
      </button>
    </div>
  );
}

function SuccessStat({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <div className="min-w-[78px] rounded-2xl border border-[#E3EAF1] bg-white px-2 py-2.5 text-center">
      <div className="num text-[18px] font-bold" style={{ color }}>{fmt(n)}</div>
      <div className="mt-0.5 text-[10px] font-semibold text-[#5E6E80]">{label}</div>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 py-16 text-center">
      <div className="mb-3.5 grid h-15 w-15 place-items-center rounded-full border border-[#E3EAF1] bg-gradient-to-br from-white to-[#E3EAF1] text-2xl">
        ⚽
      </div>
      <h3 className="text-[15px] font-bold text-[#0B1A2E]">{title}</h3>
      <p className="mt-1.5 max-w-[220px] text-[12px] text-[#5E6E80]">{body}</p>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
  retry,
}: {
  message: string;
  onRetry: () => void;
  retry: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 py-16 text-center">
      <p className="text-[13px] font-semibold text-[#C0392B]">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-full border border-[#E3EAF1] bg-white px-4 py-2 text-[12px] font-semibold text-[#0B1A2E]"
      >
        {retry}
      </button>
    </div>
  );
}

// This month, as "يوليو 2026" — Arabic month text, Western numerals (ar-u-nu-latn).
function formatPeriod(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("ar-u-nu-latn", { month: "long", year: "numeric" });
}

// A payment timestamp as a short "12 يوليو" — Western numerals (ar-u-nu-latn).
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("ar-u-nu-latn", { day: "numeric", month: "short" });
}
