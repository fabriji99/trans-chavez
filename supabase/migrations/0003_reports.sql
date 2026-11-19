-- Vistas de reportes de ingresos. security_invoker = true hace que respeten
-- las políticas RLS del usuario que consulta (un cobrador solo verá sus propios viajes).

create view revenue_by_trip
  with (security_invoker = true) as
select
  t.id as trip_id,
  t.route_id,
  r.name as route_name,
  t.departure_at,
  t.status,
  count(k.id) as ticket_count,
  coalesce(sum(k.fare_amount * k.passenger_count), 0) as total_revenue
from trips t
join routes r on r.id = t.route_id
left join tickets k on k.trip_id = t.id
group by t.id, t.route_id, r.name, t.departure_at, t.status;

create view revenue_by_day
  with (security_invoker = true) as
select
  date_trunc('day', t.departure_at) as day,
  count(distinct t.id) as trip_count,
  count(k.id) as ticket_count,
  coalesce(sum(k.fare_amount * k.passenger_count), 0) as total_revenue
from trips t
left join tickets k on k.trip_id = t.id
group by date_trunc('day', t.departure_at)
order by day desc;

create view revenue_by_route
  with (security_invoker = true) as
select
  r.id as route_id,
  r.name as route_name,
  count(distinct t.id) as trip_count,
  count(k.id) as ticket_count,
  coalesce(sum(k.fare_amount * k.passenger_count), 0) as total_revenue
from routes r
left join trips t on t.route_id = r.id
left join tickets k on k.trip_id = t.id
group by r.id, r.name;
