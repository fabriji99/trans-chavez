import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { directionLabel, isTripOverdue, minutesOpen, TRIP_OPEN_ALERT_MINUTES } from "@trans-chavez/shared";
import type { Route, Bus, Driver, Profile, Ticket, Trip, TripStatus } from "@trans-chavez/shared";

const STATUS_LABEL: Record<TripStatus, string> = {
  in_progress: "En curso",
  completed: "Finalizado",
};

const TZ = "America/Tegucigalpa";
// Honduras no usa horario de verano: UTC-6 todo el año
const TZ_OFFSET = "-06:00";

type Filters = {
  cobrador?: string;
  bus?: string;
  driver?: string;
  direction?: string;
  status?: string;
  date?: string;
  from?: string;
  to?: string;
};

/** Hora local de Honduras (HH:MM) de una fecha ISO, para filtrar por rango de hora. */
function localHHMM(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

const money = (value: number) =>
  new Intl.NumberFormat("es-HN", { style: "currency", currency: "HNL" }).format(value);

const inputClass = "rounded-xl border border-slate-200 bg-slate-50 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 px-3 py-2 text-sm";

export default async function ViajesPage({
  searchParams,
}: {
  searchParams: Promise<Filters>;
}) {
  const filters = await searchParams;
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("trips")
    .select("*")
    .order("departure_at", { ascending: false })
    .limit(200);
  if (filters.cobrador) query = query.eq("cobrador_id", filters.cobrador);
  if (filters.bus) query = query.eq("bus_id", filters.bus);
  if (filters.driver) query = query.eq("driver_id", filters.driver);
  if (filters.direction === "outbound" || filters.direction === "return") {
    query = query.eq("direction", filters.direction);
  }
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.date && /^\d{4}-\d{2}-\d{2}$/.test(filters.date)) {
    query = query
      .gte("departure_at", `${filters.date}T00:00:00${TZ_OFFSET}`)
      .lte("departure_at", `${filters.date}T23:59:59.999${TZ_OFFSET}`);
  }

  const [tripsRes, routesRes, busesRes, cobradoresRes, driversRes] = await Promise.all([
    query,
    supabase.from("routes").select("*").order("name"),
    supabase.from("buses").select("*").order("plate"),
    supabase.from("profiles").select("*").eq("role", "cobrador").order("full_name"),
    supabase.from("drivers").select("*").order("full_name"),
  ]);

  let trips = (tripsRes.data as Trip[]) ?? [];
  // El rango de hora se filtra aquí porque depende de la hora local, no de la fecha completa
  if (filters.from) trips = trips.filter((t) => localHHMM(t.departure_at) >= filters.from!);
  if (filters.to) trips = trips.filter((t) => localHHMM(t.departure_at) <= filters.to!);

  // Pasajeros y total cobrado por viaje
  const totals = new Map<string, { passengers: number; revenue: number }>();
  if (trips.length > 0) {
    const { data: ticketRows } = await supabase
      .from("tickets")
      .select("trip_id, passenger_count, fare_amount")
      .in("trip_id", trips.map((t) => t.id));
    for (const t of (ticketRows as Pick<Ticket, "trip_id" | "passenger_count" | "fare_amount">[]) ?? []) {
      const acc = totals.get(t.trip_id) ?? { passengers: 0, revenue: 0 };
      acc.passengers += t.passenger_count;
      acc.revenue += t.fare_amount * t.passenger_count;
      totals.set(t.trip_id, acc);
    }
  }

  const routes = (routesRes.data as Route[]) ?? [];
  const buses = (busesRes.data as Bus[]) ?? [];
  const cobradores = (cobradoresRes.data as Profile[]) ?? [];
  const drivers = (driversRes.data as Driver[]) ?? [];

  const routeById = new Map(routes.map((r) => [r.id, r]));
  const busById = new Map(buses.map((b) => [b.id, b]));
  const cobradorById = new Map(cobradores.map((c) => [c.id, c]));
  const driverById = new Map(drivers.map((d) => [d.id, d]));

  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-lg font-bold text-slate-900">Viajes</h1>
        <p className="text-sm text-slate-500">
          Busca y filtra los viajes que inician los cobradores desde la app.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-xs p-4 sm:p-5">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Buscar viajes</h2>
        <form method="get" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <select name="cobrador" defaultValue={filters.cobrador ?? ""} className={inputClass}>
            <option value="">Todos los cobradores</option>
            {cobradores.map((c) => (
              <option key={c.id} value={c.id}>{c.full_name}</option>
            ))}
          </select>
          <select name="bus" defaultValue={filters.bus ?? ""} className={inputClass}>
            <option value="">Todos los buses</option>
            {buses.map((b) => (
              <option key={b.id} value={b.id}>{b.plate}</option>
            ))}
          </select>
          <select name="driver" defaultValue={filters.driver ?? ""} className={inputClass}>
            <option value="">Todos los choferes</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>{d.full_name}</option>
            ))}
          </select>
          <select name="direction" defaultValue={filters.direction ?? ""} className={inputClass}>
            <option value="">Ida y vuelta</option>
            <option value="outbound">Solo ida</option>
            <option value="return">Solo vuelta</option>
          </select>
          <select name="status" defaultValue={filters.status ?? ""} className={inputClass}>
            <option value="">Todos los estados</option>
            {Object.entries(STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-xs text-slate-500">
            Fecha
            <input type="date" name="date" defaultValue={filters.date ?? ""} className={`${inputClass} flex-1`} />
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-500">
            Hora desde
            <input type="time" name="from" defaultValue={filters.from ?? ""} className={`${inputClass} flex-1`} />
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-500">
            Hasta
            <input type="time" name="to" defaultValue={filters.to ?? ""} className={`${inputClass} flex-1`} />
          </label>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
            <button
              type="submit"
              className="rounded-xl bg-blue-600 px-4 py-2.5 font-display text-sm font-bold text-white shadow-md shadow-blue-600/20 hover:bg-blue-700"
            >
              Buscar
            </button>
            {hasFilters && (
              <Link
                href="/viajes"
                className="rounded-xl border border-slate-200 bg-slate-50 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                Limpiar filtros
              </Link>
            )}
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-xs p-4 sm:p-5">
        <p className="mb-3 text-xs text-slate-500">
          {trips.length} {trips.length === 1 ? "viaje" : "viajes"}
          {hasFilters ? " con los filtros aplicados" : ""}
        </p>
        <div className="overflow-x-auto">
<table className="w-full min-w-max text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <th className="py-2">Salida</th>
              <th className="py-2">Ruta y sentido</th>
              <th className="py-2">Bus</th>
              <th className="py-2">Cobrador</th>
              <th className="py-2">Chofer</th>
              <th className="py-2 text-center">Pasajeros</th>
              <th className="py-2 text-right">Total</th>
              <th className="py-2 pl-8">Estado</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {trips.map((trip) => {
              const route = routeById.get(trip.route_id);
              return (
                <tr key={trip.id} className="border-b border-slate-100">
                  <td className="py-2 text-slate-900">
                    {new Date(trip.departure_at).toLocaleString("es-HN", { timeZone: TZ })}
                  </td>
                  <td className="py-2 text-slate-600">
                    {route ? directionLabel(route, trip.direction) : "—"}
                  </td>
                  <td className="py-2 text-slate-600">{busById.get(trip.bus_id)?.plate ?? "—"}</td>
                  <td className="py-2 text-slate-600">
                    {cobradorById.get(trip.cobrador_id)?.full_name ?? "—"}
                  </td>
                  <td className="py-2 text-slate-600">
                    {trip.driver_id ? (driverById.get(trip.driver_id)?.full_name ?? "—") : "—"}
                  </td>
                  <td className="py-2 text-center text-slate-600">
                    {totals.get(trip.id)?.passengers ?? 0}
                  </td>
                  <td className="py-2 text-right font-medium text-slate-900">
                    {money(totals.get(trip.id)?.revenue ?? 0)}
                  </td>
                  <td className="py-2 pl-8">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        trip.status === "in_progress"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {STATUS_LABEL[trip.status]}
                    </span>
                    {isTripOverdue(trip) && (
                      <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        Abierto {minutesOpen(trip)} min (más de {TRIP_OPEN_ALERT_MINUTES})
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-right">
                    <Link
                      href={`/viajes/${trip.id}`}
                      className="rounded-xl border border-slate-200 bg-slate-50 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
                    >
                      Ver boletos
                    </Link>
                  </td>
                </tr>
              );
            })}
            {trips.length === 0 && (
              <tr>
                <td colSpan={9} className="py-4 text-center text-slate-400">
                  {hasFilters
                    ? "No hay viajes que coincidan con los filtros."
                    : "Aún no hay viajes."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
</div>
      </section>
    </div>
  );
}
