CREATE TYPE public.app_role AS ENUM ('borrower','officer');
CREATE TYPE public.loan_status AS ENUM ('pending','approved','declined');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  cell_phone text NOT NULL DEFAULT '',
  street text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT '',
  zip text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  account_number text NOT NULL,
  balance numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.accounts TO authenticated;
GRANT ALL ON public.accounts TO service_role;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.loan_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL,
  apr numeric(6,2) NOT NULL,
  term_months integer NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  ssn text NOT NULL,
  dob date,
  cell_phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  street text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT '',
  zip text NOT NULL DEFAULT '',
  employer text NOT NULL DEFAULT '',
  job_title text NOT NULL DEFAULT '',
  annual_income text NOT NULL DEFAULT '',
  loan_purpose text NOT NULL DEFAULT '',
  signature text NOT NULL DEFAULT '',
  status public.loan_status NOT NULL DEFAULT 'pending',
  decided_at timestamptz,
  disbursed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.loan_applications TO authenticated;
GRANT ALL ON public.loan_applications TO service_role;
ALTER TABLE public.loan_applications ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  category text NOT NULL,
  description text NOT NULL,
  amount numeric(14,2) NOT NULL,
  direction text NOT NULL,
  status text NOT NULL DEFAULT 'completed',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'officer'));
CREATE POLICY "own profile write" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "own roles read" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "own accounts read" ON public.accounts FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "own loans read" ON public.loan_applications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'officer'));
CREATE POLICY "own loans insert" ON public.loan_applications FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "own transactions read" ON public.transactions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  suffix text := lpad((floor(random()*100000000))::bigint::text, 8, '0');
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, email, cell_phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name',''),
    COALESCE(NEW.raw_user_meta_data->>'last_name',''),
    COALESCE(NEW.email,''),
    COALESCE(NEW.raw_user_meta_data->>'cell_phone','')
  );

  IF lower(COALESCE(NEW.email,'')) = 'ovoroc7@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'officer');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'borrower');
    INSERT INTO public.accounts (user_id, name, kind, is_primary, account_number)
      VALUES (NEW.id, 'Primary Checking', 'checking', true, '****' || suffix);
    INSERT INTO public.accounts (user_id, name, kind, is_primary, account_number)
      VALUES (NEW.id, 'Everyday Savings', 'savings', false, '****' || lpad((floor(random()*100000000))::bigint::text, 8, '0'));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.decide_loan(_application_id uuid, _approve boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  app public.loan_applications%ROWTYPE;
  checking public.accounts%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(),'officer') THEN
    RAISE EXCEPTION 'Only loan officers can decide applications';
  END IF;

  SELECT * INTO app FROM public.loan_applications WHERE id = _application_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Application not found'; END IF;
  IF app.status <> 'pending' THEN RAISE EXCEPTION 'Application already decided'; END IF;

  IF _approve THEN
    SELECT * INTO checking FROM public.accounts
      WHERE user_id = app.user_id AND kind = 'checking' ORDER BY is_primary DESC LIMIT 1;
    IF NOT FOUND THEN RAISE EXCEPTION 'No checking account found'; END IF;

    UPDATE public.accounts SET balance = balance + app.amount WHERE id = checking.id;
    INSERT INTO public.transactions (user_id, account_id, category, description, amount, direction, status)
      VALUES (app.user_id, checking.id, 'disbursement', 'Loan disbursement - personal loan', app.amount, 'credit', 'completed');
    UPDATE public.loan_applications
      SET status = 'approved', decided_at = now(), disbursed_at = now() WHERE id = app.id;
  ELSE
    UPDATE public.loan_applications
      SET status = 'declined', decided_at = now() WHERE id = app.id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.transfer_between_accounts(_from uuid, _to uuid, _amount numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE src public.accounts%ROWTYPE; dst public.accounts%ROWTYPE;
BEGIN
  IF _amount <= 0 THEN RAISE EXCEPTION 'Amount must be greater than zero'; END IF;
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
$$;

CREATE OR REPLACE FUNCTION public.send_money(_from uuid, _amount numeric, _category text, _recipient text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE src public.accounts%ROWTYPE; label text;
BEGIN
  IF _amount <= 0 THEN RAISE EXCEPTION 'Amount must be greater than zero'; END IF;
  IF _category NOT IN ('zelle','external_transfer') THEN RAISE EXCEPTION 'Unsupported transfer type'; END IF;
  SELECT * INTO src FROM public.accounts WHERE id = _from AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Account not found'; END IF;
  IF src.balance < _amount THEN RAISE EXCEPTION 'Insufficient funds'; END IF;

  label := CASE WHEN _category = 'zelle' THEN 'Zelle payment to ' ELSE 'Transfer to ' END || _recipient;
  UPDATE public.accounts SET balance = balance - _amount WHERE id = src.id;
  INSERT INTO public.transactions (user_id, account_id, category, description, amount, direction)
    VALUES (auth.uid(), src.id, _category, label, _amount, 'debit');
END;
$$;