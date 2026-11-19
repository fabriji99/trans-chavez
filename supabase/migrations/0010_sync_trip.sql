-- Sincronización de viajes hechos sin conexión.
-- La app guarda el viaje y sus boletos en el teléfono (con IDs propios) y los envía
-- con esta función cuando hay señal. Es idempotente: se puede llamar varias veces
-- durante el viaje o al finalizarlo sin duplicar nada.

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

  select status, cobrador_id into v_status, v_owner from trips where id = v_id;

  if not found then
    insert into trips (
      id, route_id, bus_id, cobrador_id, driver_id, direction,
      departure_at, started_at, ended_at, status
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
      (p_trip->>'status')::trip_status
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
        status = (p_trip->>'status')::trip_status
      where id = v_id;
    end if;
  end if;

  insert into tickets (
    id, trip_id, boarding_stop_id, alighting_stop_id, passenger_count,
    fare_amount, payment_method, created_by, created_at
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
    (x->>'created_at')::timestamptz
  from jsonb_array_elements(p_tickets) x
  on conflict (id) do nothing;
end;
$$;

revoke execute on function sync_trip(jsonb, jsonb) from public;
grant execute on function sync_trip(jsonb, jsonb) to authenticated;
