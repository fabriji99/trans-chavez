export type UserRole = "admin" | "cobrador";
export type TripStatus = "in_progress" | "completed";
export type PaymentMethod = "cash";
export type TripDirection = "outbound" | "return";

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  phone: string | null;
  /** Código corto del cobrador (C01, C02...) usado en el número de boleto. */
  code: string | null;
  created_at: string;
}

export interface Bus {
  id: string;
  plate: string;
  name: string | null;
  capacity: number;
  active: boolean;
  created_at: string;
}

export interface Driver {
  id: string;
  full_name: string;
  phone: string | null;
  active: boolean;
  created_at: string;
}

export interface Route {
  id: string;
  name: string;
  origin: string;
  destination: string;
  active: boolean;
  created_at: string;
}

export interface Stop {
  id: string;
  route_id: string;
  name: string;
  sequence: number;
  active: boolean;
}

/** Precio de ir desde la parada hasta el final del recorrido, por sentido. */
export interface StopPrice {
  stop_id: string;
  direction: TripDirection;
  price_to_end: number;
}

/** @deprecated reemplazado por StopPrice */
export interface Fare {
  id: string;
  route_id: string;
  from_stop_id: string;
  to_stop_id: string;
  price: number;
}

export interface Trip {
  id: string;
  route_id: string;
  bus_id: string;
  cobrador_id: string;
  driver_id: string | null;
  direction: TripDirection;
  departure_at: string;
  /** Horario de la ruta al que se asignó el viaje (null = fuera de horario o sin horarios). */
  scheduled_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  /** Última vez que el servidor recibió este viaje desde la app. */
  synced_at: string | null;
  status: TripStatus;
  created_at: string;
}

export interface RouteSchedule {
  id: string;
  route_id: string;
  direction: TripDirection;
  /** Hora de salida HH:MM:SS (hora de Honduras). */
  depart_time: string;
  created_at: string;
}

export interface Ticket {
  id: string;
  trip_id: string;
  boarding_stop_id: string;
  alighting_stop_id: string;
  passenger_count: number;
  fare_amount: number;
  payment_method: PaymentMethod;
  created_by: string;
  created_at: string;
  /** Cuándo el servidor recibió el boleto (puede ser null en boletos antiguos). */
  synced_at: string | null;
  /** Número visible del boleto, ej. C01-061026-0007 (null en boletos antiguos). */
  ticket_number: string | null;
}

export interface RevenueByTrip {
  trip_id: string;
  route_id: string;
  route_name: string;
  departure_at: string;
  status: TripStatus;
  ticket_count: number;
  total_revenue: number;
}

export interface RevenueByDay {
  day: string;
  trip_count: number;
  ticket_count: number;
  total_revenue: number;
}

export interface RevenueByRoute {
  route_id: string;
  route_name: string;
  trip_count: number;
  ticket_count: number;
  total_revenue: number;
}
