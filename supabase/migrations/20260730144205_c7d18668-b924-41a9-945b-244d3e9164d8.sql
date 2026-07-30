CREATE TABLE public.withdrawal_pins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pin_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.withdrawal_pins TO service_role;
ALTER TABLE public.withdrawal_pins ENABLE ROW LEVEL SECURITY;
-- no policies: only accessible through security definer functions below

CREATE OR REPLACE FUNCTION public.set_withdrawal_pin(_pin text, _current_pin text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE existing text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF _pin !~ '^\d{4,6}$' THEN RAISE EXCEPTION 'Withdrawal code must be 4 to 6 digits'; END IF;

  SELECT pin_hash INTO existing FROM public.withdrawal_pins WHERE user_id = auth.uid();
  IF existing IS NOT NULL THEN
    IF _current_pin IS NULL OR extensions.crypt(_current_pin, existing) <> existing THEN
      RAISE EXCEPTION 'Current withdrawal code is incorrect';
    END IF;
  END IF;

  INSERT INTO public.withdrawal_pins (user_id, pin_hash, updated_at)
  VALUES (auth.uid(), extensions.crypt(_pin, extensions.gen_salt('bf')), now())
  ON CONFLICT (user_id) DO UPDATE SET pin_hash = EXCLUDED.pin_hash, updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.has_withdrawal_pin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.withdrawal_pins WHERE user_id = auth.uid());
$$;

DROP FUNCTION IF EXISTS public.send_money(uuid, numeric, text, text);

CREATE OR REPLACE FUNCTION public.send_money(_from uuid, _amount numeric, _category text, _recipient text, _pin text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.set_withdrawal_pin(text, text) FROM public;
REVOKE ALL ON FUNCTION public.has_withdrawal_pin() FROM public;
REVOKE ALL ON FUNCTION public.send_money(uuid, numeric, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.set_withdrawal_pin(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_withdrawal_pin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_money(uuid, numeric, text, text, text) TO authenticated;