-- M4.5 (2/2): cheque lifecycle — payment status + cheque number.
-- Depends on 0012 having committed the 'cheque' method value.
--
-- THE LOAD-BEARING RULE (Atlas ruling, plan M4.5): a payment counts toward a due's
-- paid total ONLY when status = 'cleared'. A pending cheque hasn't really paid yet;
-- a bounced cheque un-pays. Both contribute 0, so the due stays open / reopens —
-- derived at read-time (the TS money() layer sums cleared-only), never stored.
-- Cash/transfer are cleared on arrival, so they count immediately as before.

-- 1. payment status. Cash/transfer arrive 'cleared'; a cheque starts 'pending'
-- and becomes 'cleared' or 'bounced'. Default 'cleared' backfills the existing
-- cash/transfer rows correctly (they were paid) and keeps recordPayment's
-- cash-default a no-op.
create type public.payment_status as enum ('pending', 'cleared', 'bounced');
alter table public.payments
  add column status public.payment_status not null default 'cleared';

-- 2. cheque number — the bank returns a bounced cheque with only this number, no
-- name, so it's the primary reconciliation key (plan amendment 2026-06-27). text
-- (cheque numbers can have leading zeros / be long — never a numeric). Indexed:
-- findPaymentByChequeNumber looks a payment up by it.
alter table public.payments add column cheque_number text;
create index payments_cheque_number_idx on public.payments (cheque_number);

-- 3. cheque_number is required for cheques and forbidden otherwise — enforced in
-- the DB so neither a numberless cheque nor a numbered cash row can ever exist,
-- regardless of code path (owner ruling 2026-06-28). method::text avoids the
-- in-txn enum cast; existing cash/transfer rows have a null number so they pass.
alter table public.payments add constraint payments_cheque_number_iff_cheque check (
  (method::text = 'cheque' and cheque_number is not null)
  or
  (method::text <> 'cheque' and cheque_number is null)
);
