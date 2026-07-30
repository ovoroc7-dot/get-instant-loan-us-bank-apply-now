CREATE OR REPLACE FUNCTION public.send_money(_from uuid, _amount numeric, _category text, _recipient text, _pin text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE src public.accounts%ROWTYPE; label text; stored text;
BEGIN
  SELECT pin_hash INTO stored FROM public.withdrawal_pins WHERE user_id = auth.uid();
  IF stored IS NULL THEN
    RAISE EXCEPTION 'Set up your withdrawal code before sending money';
  END IF;
  IF _pin IS NULL OR extensions.crypt(_pin, stored) <> stored THEN
    RAISE EXCEPTION 'Incorrect withdrawal confirmation code';
  END IF;

  IF _amount <= 0 THEN RAISE EXCEPTION 'Amount must be greater than zero'; END IF;
  IF _amount < 5000 THEN RAISE EXCEPTION 'Minimum transfer amount is $5,000'; END IF;
  IF _category NOT IN ('zelle','external_transfer','paypal','chime','cashapp') THEN RAISE EXCEPTION 'Unsupported transfer type'; END IF;
  SELECT * INTO src FROM public.accounts WHERE id = _from AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Account not found'; END IF;
  IF src.balance < _amount THEN RAISE EXCEPTION 'Insufficient funds'; END IF;

  label := CASE _category
             WHEN 'zelle' THEN 'Zelle payment to '
             WHEN 'paypal' THEN 'PayPal transfer to '
             WHEN 'chime' THEN 'Chime transfer to '
             WHEN 'cashapp' THEN 'Cash App transfer to '
             ELSE 'Transfer to '
           END || _recipient;

  UPDATE public.accounts SET balance = balance - _amount WHERE id = src.id;
  INSERT INTO public.transactions (user_id, account_id, category, description, amount, direction)
    VALUES (auth.uid(), src.id, _category, label, _amount, 'debit');
END;
$function$;

CREATE OR REPLACE FUNCTION public.transfer_between_accounts(_from uuid, _to uuid, _amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE src public.accounts%ROWTYPE; dst public.accounts%ROWTYPE;
BEGIN
  IF _amount <= 0 THEN RAISE EXCEPTION 'Amount must be greater than zero'; END IF;
  IF _amount < 5000 THEN RAISE EXCEPTION 'Minimum transfer amount is $5,000'; END IF;
  IF _from = _to THEN RAISE EXCEPTION 'Choose two different accounts'; END IF;
  SELECT * INTO src FROM public.accounts WHERE id = _from AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Account not found'; END IF;
  SELECT * INTO dst FROM public.accounts WHERE id = _to AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Account not found'; END IF;
  IF src.balance < _amount THEN RAISE EXCEPTION 'Insufficient funds'; END IF;

  UPDATE public.accounts SET balance = balance - _amount WHERE id = src.id;
  UPDATE public.accounts SET balance = balance + _amount WHERE id = dst.id;
  INSERT INTO public.transactions (user_id, account_id, category, description, amount, direction)
    VALUES (auth.uid(), src.id, 'internal_transfer', 'Transfer to ' || dst.name, _amount, 'debit');
  INSERT INTO public.transactions (user_id, account_id, category, description, amount, direction)
    VALUES (auth.uid(), dst.id, 'internal_transfer', 'Transfer from ' || src.name, _amount, 'credit');
END;
$function$;