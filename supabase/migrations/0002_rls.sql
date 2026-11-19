-- Políticas de seguridad a nivel de fila (RLS)
-- admin: acceso total. cobrador: solo lee catálogos y solo lee/crea boletos de sus propios viajes.

create or replace function auth_role()
returns user_role
language sql
security definer
stable
set search_path = public
as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select auth_role() = 'admin';
$$;

alter table profiles enable row level security;
alter table buses enable row level security;
alter table routes enable row level security;
alter table stops enable row level security;
alter table fares enable row level security;
alter table trips enable row level security;
alter table tickets enable row level security;

-- profiles: cada usuario ve su propio perfil; admin ve todos
create policy "profiles_select_own_or_admin" on profiles
  for select using (id = auth.uid() or is_admin());
create policy "profiles_admin_write" on profiles
  for all using (is_admin()) with check (is_admin());

-- catálogos (buses, routes, stops, fares): lectura para cualquier usuario autenticado, escritura solo admin
create policy "buses_read_authenticated" on buses
  for select using (auth.uid() is not null);
create policy "buses_admin_write" on buses
  for insert with check (is_admin());
create policy "buses_admin_update" on buses
  for update using (is_admin()) with check (is_admin());
create policy "buses_admin_delete" on buses
  for delete using (is_admin());

create policy "routes_read_authenticated" on routes
  for select using (auth.uid() is not null);
create policy "routes_admin_write" on routes
  for insert with check (is_admin());
create policy "routes_admin_update" on routes
  for update using (is_admin()) with check (is_admin());
create policy "routes_admin_delete" on routes
  for delete using (is_admin());

create policy "stops_read_authenticated" on stops
  for select using (auth.uid() is not null);
create policy "stops_admin_write" on stops
  for insert with check (is_admin());
create policy "stops_admin_update" on stops
  for update using (is_admin()) with check (is_admin());
create policy "stops_admin_delete" on stops
  for delete using (is_admin());

create policy "fares_read_authenticated" on fares
  for select using (auth.uid() is not null);
create policy "fares_admin_write" on fares
  for insert with check (is_admin());
create policy "fares_admin_update" on fares
  for update using (is_admin()) with check (is_admin());
create policy "fares_admin_delete" on fares
  for delete using (is_admin());

-- trips: cobrador ve solo sus propios viajes; admin ve y administra todos
create policy "trips_select_own_or_admin" on trips
  for select using (cobrador_id = auth.uid() or is_admin());
create policy "trips_admin_write" on trips
  for insert with check (is_admin());
create policy "trips_admin_update" on trips
  for update using (is_admin()) with check (is_admin());
create policy "trips_admin_delete" on trips
  for delete using (is_admin());
-- el cobrador puede actualizar el estado de su propio viaje (ej. marcar in_progress/completed)
create policy "trips_cobrador_update_status" on trips
  for update using (cobrador_id = auth.uid())
  with check (cobrador_id = auth.uid());

-- tickets: cobrador ve/crea boletos solo de sus propios viajes; admin ve y administra todos
create policy "tickets_select_own_trip_or_admin" on tickets
  for select using (
    is_admin() or exists (
      select 1 from trips t where t.id = tickets.trip_id and t.cobrador_id = auth.uid()
    )
  );
create policy "tickets_insert_own_trip_or_admin" on tickets
  for insert with check (
    created_by = auth.uid() and (
      is_admin() or exists (
        select 1 from trips t where t.id = tickets.trip_id and t.cobrador_id = auth.uid()
      )
    )
  );
create policy "tickets_admin_update" on tickets
  for update using (is_admin()) with check (is_admin());
create policy "tickets_admin_delete" on tickets
  for delete using (is_admin());
