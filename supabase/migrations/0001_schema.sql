-- Trans. Chávez — esquema base para cobro de pasajes
-- Roles de la app: 'admin' (panel web) y 'cobrador' (app móvil)

create type user_role as enum ('admin', 'cobrador');
create type trip_status as enum ('scheduled', 'in_progress', 'completed');
create type payment_method as enum ('cash');

-- Perfil de cada usuario autenticado (extiende auth.users)
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role user_role not null default 'cobrador',
  full_name text not null,
  phone text,
  created_at timestamptz not null default now()
);

create table buses (
  id uuid primary key default gen_random_uuid(),
  plate text not null unique,
  name text,
  capacity int not null default 40,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table routes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  origin text not null,
  destination text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Paradas ordenadas de una ruta (sequence define el orden de origen a destino)
create table stops (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references routes (id) on delete cascade,
  name text not null,
  sequence int not null,
  active boolean not null default true,
  unique (route_id, sequence)
);

-- Matriz de tarifas por tramo: precio de subir en from_stop y bajar en to_stop
create table fares (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references routes (id) on delete cascade,
  from_stop_id uuid not null references stops (id) on delete cascade,
  to_stop_id uuid not null references stops (id) on delete cascade,
  price numeric(10, 2) not null check (price >= 0),
  unique (route_id, from_stop_id, to_stop_id),
  check (from_stop_id <> to_stop_id)
);

create table trips (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references routes (id) on delete restrict,
  bus_id uuid not null references buses (id) on delete restrict,
  cobrador_id uuid not null references profiles (id) on delete restrict,
  departure_at timestamptz not null,
  status trip_status not null default 'scheduled',
  created_at timestamptz not null default now()
);

create table tickets (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips (id) on delete cascade,
  boarding_stop_id uuid not null references stops (id),
  alighting_stop_id uuid not null references stops (id),
  passenger_count int not null default 1 check (passenger_count > 0),
  fare_amount numeric(10, 2) not null check (fare_amount >= 0),
  payment_method payment_method not null default 'cash',
  created_by uuid not null references profiles (id),
  created_at timestamptz not null default now(),
  check (boarding_stop_id <> alighting_stop_id)
);

create index idx_stops_route on stops (route_id);
create index idx_fares_route on fares (route_id);
create index idx_trips_cobrador on trips (cobrador_id);
create index idx_trips_route on trips (route_id);
create index idx_tickets_trip on tickets (trip_id);
create index idx_tickets_created_at on tickets (created_at);
