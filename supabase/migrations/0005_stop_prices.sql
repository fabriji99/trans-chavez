-- Precio por parada: cada parada guarda cuánto cuesta ir desde ella hasta el
-- final del recorrido, por sentido. El precio de un tramo es la diferencia
-- entre el precio de la parada de subida y el de la parada de bajada.
-- Reemplaza el uso de la matriz `fares` (la tabla se conserva sin usarse).

create type trip_direction as enum ('outbound', 'return');

alter table trips add column direction trip_direction not null default 'outbound';

create table stop_prices (
  stop_id uuid not null references stops (id) on delete cascade,
  direction trip_direction not null,
  price_to_end numeric(10, 2) not null check (price_to_end >= 0),
  primary key (stop_id, direction)
);

alter table stop_prices enable row level security;

create policy "stop_prices_read_authenticated" on stop_prices
  for select using (auth.uid() is not null);
create policy "stop_prices_admin_insert" on stop_prices
  for insert with check (is_admin());
create policy "stop_prices_admin_update" on stop_prices
  for update using (is_admin()) with check (is_admin());
create policy "stop_prices_admin_delete" on stop_prices
  for delete using (is_admin());

-- Migra los datos de ejemplo: precio hacia el último stop de la ruta (ida)
-- y desde el primero (vuelta), tomados de la matriz `fares` si existen.
insert into stop_prices (stop_id, direction, price_to_end)
select s.id, 'outbound',
  coalesce((
    select f.price from fares f
    where f.from_stop_id = s.id
      and f.to_stop_id = (select id from stops where route_id = s.route_id order by sequence desc limit 1)
  ), 0)
from stops s
on conflict do nothing;

insert into stop_prices (stop_id, direction, price_to_end)
select s.id, 'return',
  coalesce((
    select f.price from fares f
    where f.to_stop_id = s.id
      and f.from_stop_id = (select id from stops where route_id = s.route_id order by sequence asc limit 1)
  ), 0)
from stops s
on conflict do nothing;
