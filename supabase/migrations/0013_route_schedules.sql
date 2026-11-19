-- Horarios de salida por ruta y sentido, y horario asignado a cada viaje.
-- La hora real de apertura sigue en trips.started_at; scheduled_at es el horario
-- de la ruta más cercano (null = fuera de horario o ruta sin horarios).

create table route_schedules (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references routes(id) on delete cascade,
  direction trip_direction not null,
  depart_time time not null,
  created_at timestamptz not null default now(),
  unique (route_id, direction, depart_time)
);

alter table route_schedules enable row level security;

create policy "route_schedules_read_authenticated" on route_schedules
  for select using (auth.uid() is not null);
create policy "route_schedules_admin_insert" on route_schedules
  for insert with check (is_admin());
create policy "route_schedules_admin_update" on route_schedules
  for update using (is_admin()) with check (is_admin());
create policy "route_schedules_admin_delete" on route_schedules
  for delete using (is_admin());

alter table trips add column scheduled_at timestamptz;

create or replace function sync_trip(p_trip jsonb, p_tickets jsonb default '[]'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid := (p_trip->>'id')::uuid;
  v_status trip_status;
  v_owner uuid;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  -- Marca esta transacción como sincronización legítima (ver protect_synced_at)
  perform set_config('app.sync', '1', true);

  select status, cobrador_id into v_status, v_owner from trips where id = v_id;

  if not found then
    insert into trips (
      id, route_id, bus_id, cobrador_id, driver_id, direction,
      departure_at, started_at, ended_at, status, synced_at, scheduled_at
    ) values (
      v_id,
      (p_trip->>'route_id')::uuid,
      (p_trip->>'bus_id')::uuid,
      v_uid,
      nullif(p_trip->>'driver_id', '')::uuid,
      (p_trip->>'direction')::trip_direction,
      (p_trip->>'departure_at')::timestamptz,
      nullif(p_trip->>'started_at', '')::timestamptz,
      nullif(p_trip->>'ended_at', '')::timestamptz,
      (p_trip->>'status')::trip_status,
      now(),
      nullif(p_trip->>'scheduled_at', '')::timestamptz
    );
  else
    if v_owner is distinct from v_uid then
      raise exception 'Este viaje pertenece a otro cobrador';
    end if;
    -- Un viaje ya finalizado no se modifica
    if v_status = 'in_progress' then
      update trips set
        bus_id = (p_trip->>'bus_id')::uuid,
        driver_id = nullif(p_trip->>'driver_id', '')::uuid,
        departure_at = (p_trip->>'departure_at')::timestamptz,
        started_at = nullif(p_trip->>'started_at', '')::timestamptz,
        ended_at = nullif(p_trip->>'ended_at', '')::timestamptz,
        status = (p_trip->>'status')::trip_status,
        synced_at = now()
      where id = v_id;
    end if;
  end if;

  insert into tickets (
    id, trip_id, boarding_stop_id, alighting_stop_id, passenger_count,
    fare_amount, payment_method, created_by, created_at, synced_at, ticket_number
  )
  select
    (x->>'id')::uuid,
    v_id,
    (x->>'boarding_stop_id')::uuid,
    (x->>'alighting_stop_id')::uuid,
    (x->>'passenger_count')::int,
    (x->>'fare_amount')::numeric,
    (x->>'payment_method')::payment_method,
    v_uid,
    (x->>'created_at')::timestamptz,
    now(),
    nullif(x->>'ticket_number', '')
  from jsonb_array_elements(p_tickets) x
  on conflict (id) do nothing;
end;
$$;

revoke execute on function sync_trip(jsonb, jsonb) from public;
grant execute on function sync_trip(jsonb, jsonb) to authenticated;
