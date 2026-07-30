CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.profiles (id, first_name, last_name, email, cell_phone)
VALUES ('5ecc91eb-8a8a-469d-897e-e098cd4422f8', '', '', 'ovoroc7@gmail.com', '')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
VALUES ('5ecc91eb-8a8a-469d-897e-e098cd4422f8', 'officer')
ON CONFLICT (user_id, role) DO NOTHING;