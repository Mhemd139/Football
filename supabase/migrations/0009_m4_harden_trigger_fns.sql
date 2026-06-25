-- Harden M4 trigger functions: they are SECURITY DEFINER and were exposed on the
-- REST RPC surface (/rest/v1/rpc/...). They only ever fire as table triggers —
-- a direct RPC call can't supply a trigger record and writes nothing — but they
-- have no business in the public API. Revoke EXECUTE so they vanish from the RPC
-- surface (triggers still fire: a trigger runs as the table owner regardless).
revoke execute on function public.assert_dues_category() from public, anon, authenticated;
revoke execute on function public.assert_salary_category() from public, anon, authenticated;
