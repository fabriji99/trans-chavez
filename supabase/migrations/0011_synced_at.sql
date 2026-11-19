-- Guarda cuándo el servidor recibió cada viaje y boleto (hora del servidor, no del teléfono),
-- para detectar cierres tardíos o manipulados. trips.synced_at es la última sincronización;
-- tickets.synced_at es cuándo llegó ese boleto.

alter table trips add column synced_at timestamptz;
alter table tickets add column synced_at timestamptz;

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
      departure_at, started_at, ended_at, status, synced_at
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
      now()
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
    fare_amount, payment_method, created_by, created_at, synced_at
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
    now()
  from jsonb_array_elements(p_tickets) x
  on conflict (id) do nothing;
end;
$$;

-- synced_at solo lo puede escribir sync_trip: un cobrador no puede falsearlo con un insert/update directo
create or replace function protect_synced_at()
returns trigger
language plpgsql
as $$
begin
  if is_admin() or current_setting('app.sync', true) = '1' then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    new.synced_at := old.synced_at;
  else
    new.synced_at := null;
  end if;
  return new;
end;
$$;

create trigger trips_protect_synced_at
  before insert or update on trips
  for each row execute function protect_synced_at();

create trigger tickets_protect_synced_at
  before insert or update on tickets
  for each row execute function protect_synced_at();

revoke execute on function sync_trip(jsonb, jsonb) from public;
grant execute on function sync_trip(jsonb, jsonb) to authenticated;
