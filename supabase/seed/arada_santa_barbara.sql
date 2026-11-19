-- Ruta Arada <-> Santa Bárbara con paradas y precios por sentido.
-- Los precios de la lista original son "desde el origen del viaje hasta la parada";
-- aquí se guardan como precio hasta el final (total - precio desde origen).
-- Ida (Arada -> SB) y vuelta (SB -> Arada) tienen total L 30.

with r as (
  insert into routes (name, origin, destination)
  values ('Arada - Santa Bárbara', 'Arada', 'Santa Bárbara')
  returning id
)
insert into stops (route_id, name, sequence)
select r.id, s.name, s.seq
from r, (values
  ('Arada', 1), ('Aguagua', 2), ('San Vicente', 3), ('Ulúa', 4),
  ('Tencoa', 5), ('Ceibita', 6), ('Santa Bárbara', 7)
) as s(name, seq);

insert into stop_prices (stop_id, direction, price_to_end)
select st.id, p.direction::trip_direction, p.price_to_end
from stops st
join routes r on r.id = st.route_id and r.name = 'Arada - Santa Bárbara'
join (values
  -- ida: 30 - (precio desde Arada)
  ('Arada',         'outbound', 30), ('Aguagua',    'outbound', 20),
  ('San Vicente',   'outbound', 15), ('Ulúa',       'outbound', 10),
  ('Tencoa',        'outbound', 10), ('Ceibita',    'outbound', 5),
  ('Santa Bárbara', 'outbound', 0),
  -- vuelta: 30 - (precio desde Santa Bárbara)
  ('Santa Bárbara', 'return', 30), ('Ceibita',     'return', 20),
  ('Tencoa',        'return', 15), ('Ulúa',        'return', 15),
  ('San Vicente',   'return', 10), ('Aguagua',     'return', 5),
  ('Arada',         'return', 0)
) as p(stop_name, direction, price_to_end) on p.stop_name = st.name;
