-- M4.5 (1/2): add 'cheque' to the payment_method enum.
-- Split from the rest of the cheque-lifecycle schema (0013) on purpose: Postgres
-- cannot add an enum value AND reference that new value in the same transaction
-- ("unsafe use of new value"). apply_migration runs each migration in a txn, so
-- the value must be committed here before 0013's column + CHECK can mention it.
-- Idempotent (if not exists) so a re-run is a no-op.
alter type public.payment_method add value if not exists 'cheque';
