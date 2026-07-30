REVOKE EXECUTE ON FUNCTION public.decide_loan(uuid, boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.transfer_between_accounts(uuid, uuid, numeric) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.send_money(uuid, numeric, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.decide_loan(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_between_accounts(uuid, uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_money(uuid, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;