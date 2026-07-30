CREATE OR REPLACE FUNCTION public.send_money(_from uuid, _amount numeric, _category text, _recipient text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE src public.accounts%ROWTYPE; label text;
BEGIN
  IF _amount <= 0 THEN RAISE EXCEPTION 'Amount must be greater than zero'; END IF;
  IF _category NOT IN ('zelle','external_transfer','paypal','chime') THEN RAISE EXCEPTION 'Unsupported transfer type'; END IF;
  SELECT * INTO src FROM public.accounts WHERE id = _from AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Account not found'; END IF;
  IF src.balance < _amount THEN RAISE EXCEPTION 'Insufficient funds'; END IF;

  label := CASE _category
             WHEN 'zelle' THEN 'Zelle payment to '
             WHEN 'paypal' THEN 'PayPal transfer to '
             WHEN 'chime' THEN 'Chime transfer to '
             ELSE 'Transfer to '
           END || _recipient;

  UPDATE public.accounts SET balance = balance - _amount WHERE id = src.id;
  INSERT INTO public.transactions (user_id, account_id, category, description, amount, direction)
    VALUES (auth.uid(), src.id, _category, label, _amount, 'debit');
END;
$function$;