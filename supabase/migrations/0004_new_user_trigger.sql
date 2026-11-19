-- Crea automáticamente una fila en `profiles` cuando se registra un usuario en Supabase Auth.
-- El rol por defecto es 'cobrador'; para crear un admin, pasar role: 'admin' en las opciones
-- de creación del usuario (user_metadata), como hace admin.auth.admin.createUser en la app web.

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, role, full_name, phone)
  values (
    new.id,
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'cobrador'),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.raw_user_meta_data ->> 'phone'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
