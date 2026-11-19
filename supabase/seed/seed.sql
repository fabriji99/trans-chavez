-- Datos de ejemplo para probar el flujo completo.
-- IMPORTANTE: los usuarios (admin/cobrador) se crean desde Supabase Auth (dashboard o signup),
-- luego se debe insertar su fila correspondiente en `profiles` con el role correcto, por ejemplo:
--   insert into profiles (id, role, full_name) values ('<uuid-del-usuario-auth>', 'admin', 'Nombre Admin');

insert into routes (id, name, origin, destination) values
  ('11111111-1111-1111-1111-111111111111', 'Ruta 1', 'Ciudad A', 'Ciudad D');

insert into stops (id, route_id, name, sequence) values
  ('21111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Ciudad A (Terminal)', 1),
  ('22222222-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Cruce B', 2),
  ('23333333-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Pueblo C', 3),
  ('24444444-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Ciudad D (Terminal)', 4);

-- Precio de ir desde cada parada hasta el final del recorrido, por sentido.
-- El tramo se cobra por diferencia (ej. ida, Cruce B -> Pueblo C = 45 - 25 = 25).
insert into stop_prices (stop_id, direction, price_to_end) values
  ('21111111-1111-1111-1111-111111111111', 'outbound', 60.00),
  ('22222222-1111-1111-1111-111111111111', 'outbound', 45.00),
  ('23333333-1111-1111-1111-111111111111', 'outbound', 25.00),
  ('24444444-1111-1111-1111-111111111111', 'outbound', 0.00),
  ('24444444-1111-1111-1111-111111111111', 'return', 60.00),
  ('23333333-1111-1111-1111-111111111111', 'return', 45.00),
  ('22222222-1111-1111-1111-111111111111', 'return', 25.00),
  ('21111111-1111-1111-1111-111111111111', 'return', 0.00);

insert into buses (id, plate, name, capacity) values
  ('31111111-1111-1111-1111-111111111111', 'HN-1234', 'Unidad 1', 40);
