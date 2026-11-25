-- Endurecimiento de seguridad.

-- 1) El cobrador ya NO escribe viajes ni boletos directamente en las tablas.
--    Todo pasa por la función sync_trip (security definer), que fija la hora del servidor
--    y valida el dueño del viaje. Así un cobrador no puede, con su sesión y la API pública,
--    cambiar horas de inicio/cierre ni insertar boletos con datos inventados.
drop policy if exists "trips_cobrador_insert" on trips;
drop policy if exists "trips_cobrador_update_status" on trips;
drop policy if exists "tickets_insert_own_trip_or_admin" on tickets;

-- El administrador conserva la inserción de boletos a su nombre.
create policy "tickets_admin_insert" on tickets
  for insert with check (is_admin() and created_by = auth.uid());

-- 2) El rol de un usuario nuevo solo se toma de app_metadata, que únicamente puede escribir
--    el servidor (service role). user_metadata lo puede enviar cualquiera que se registre
--    con la clave pública, así que ya no se confía en él para decidir si alguien es admin.
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
    coalesce((new.raw_app_meta_data ->> 'role')::user_role, 'cobrador'),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.raw_user_meta_data ->> 'phone'
  );
  return new;
end;
$$;

revoke execute on function handle_new_user() from public, anon, authenticated;
