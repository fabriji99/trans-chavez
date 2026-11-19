-- Número de boleto visible (ej. C01-061026-0007 = cobrador C01, día 06/10/26, boleto 7 del día).
-- Lo genera la app en el teléfono (funciona sin señal) y el servidor exige que no se repita.
-- Un hueco en la secuencia de un cobrador en un día es señal de un boleto cobrado y no registrado.

-- Código corto de cada cobrador (C01, C02, ...)
create sequence cobrador_code_seq;

alter table profiles add column code text unique;

create or replace function assign_cobrador_code()
returns trigger
language plpgsql
as $$
begin
  if new.role = 'cobrador' and new.code is null then
    new.code := 'C' || lpad(nextval('cobrador_code_seq')::text, 2, '0');
  end if;
  return new;
end;
$$;

create trigger profiles_assign_code
  before insert or update of role on profiles
  for each row execute function assign_cobrador_code();

-- Códigos para los cobradores que ya existen
do $$
declare r record;
begin
  for r in select id from profiles where role = 'cobrador' and code is null order by created_at loop
    update profiles set code = 'C' || lpad(nextval('cobrador_code_seq')::text, 2, '0') where id = r.id;
  end loop;
end;
$$;

alter table tickets add column ticket_number text;
create unique index uniq_tickets_ticket_number on tickets (ticket_number) where ticket_number is not null;

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
