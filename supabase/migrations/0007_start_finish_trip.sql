-- El cobrador inicia y finaliza sus propios viajes eligiendo bus, chofer y hora.

create table drivers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table drivers enable row level security;

create policy "drivers_read_authenticated" on drivers
  for select using (auth.uid() is not null);
create policy "drivers_admin_insert" on drivers
  for insert with check (is_admin());
create policy "drivers_admin_update" on drivers
  for update using (is_admin()) with check (is_admin());
create policy "drivers_admin_delete" on drivers
  for delete using (is_admin());

alter table trips
  add column driver_id uuid references drivers (id) on delete set null,
  add column started_at timestamptz,
  add column ended_at timestamptz;

-- Un cobrador solo puede tener un viaje en curso a la vez
create unique index uniq_trips_one_in_progress_per_cobrador
  on trips (cobrador_id) where status = 'in_progress';

-- El cobrador puede crear viajes, pero solo a su nombre
create policy "trips_cobrador_insert" on trips
  for insert with check (cobrador_id = auth.uid());

-- Restringe qué puede cambiar un cobrador al actualizar un viaje:
-- no puede reasignar ruta/cobrador, ni reabrir un viaje completado,
-- y el estado solo avanza scheduled -> in_progress -> completed.
create or replace function enforce_cobrador_trip_update()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null or is_admin() then
    return new;
  end if;

  if new.cobrador_id is distinct from old.cobrador_id
     or new.route_id is distinct from old.route_id then
    raise exception 'No puedes cambiar la ruta ni el cobrador del viaje';
  end if;

  if old.status = 'completed' then
    raise exception 'El viaje ya fue finalizado';
  end if;

  if new.status is distinct from old.status and not (
    (old.status = 'scheduled' and new.status = 'in_progress') or
    (old.status = 'in_progress' and new.status = 'completed')
  ) then
    raise exception 'Cambio de estado no permitido';
  end if;

  return new;
end;
$$;

create trigger trips_cobrador_update_guard
  before update on trips
  for each row execute function enforce_cobrador_trip_update();

-- El cobrador solo puede vender boletos en un viaje en curso
drop policy "tickets_insert_own_trip_or_admin" on tickets;
create policy "tickets_insert_own_trip_or_admin" on tickets
  for insert with check (
    created_by = auth.uid() and (
      is_admin() or exists (
        select 1 from trips t
        where t.id = tickets.trip_id
          and t.cobrador_id = auth.uid()
          and t.status = 'in_progress'
      )
    )
  );
