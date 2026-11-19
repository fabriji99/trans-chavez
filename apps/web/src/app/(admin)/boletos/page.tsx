import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Ticket, Trip, Route, Stop } from "@trans-chavez/shared";

export default async function BoletosPage() {
  const supabase = await createSupabaseServerClient();

  const [ticketsRes, tripsRes, routesRes, stopsRes] = await Promise.all([
    supabase
      .from("tickets")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("trips").select("*"),
    supabase.from("routes").select("*"),
    supabase.from("stops").select("*"),
  ]);

  const tickets = (ticketsRes.data as Ticket[]) ?? [];
  const trips = (tripsRes.data as Trip[]) ?? [];
  const routes = (routesRes.data as Route[]) ?? [];
  const stops = (stopsRes.data as Stop[]) ?? [];

  const tripById = new Map(trips.map((t) => [t.id, t]));
  const routeById = new Map(routes.map((r) => [r.id, r]));
  const stopById = new Map(stops.map((s) => [s.id, s]));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-lg font-bold text-slate-900">Boletos</h1>
        <p className="text-sm text-slate-500">
          Últimos 100 boletos vendidos, en todas las rutas.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-xs p-4 sm:p-5">
        <div className="overflow-x-auto">
<table className="w-full min-w-max text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <th className="py-2">N.º boleto</th>
              <th className="py-2">Fecha</th>
              <th className="py-2">Ruta</th>
              <th className="py-2">Tramo</th>
              <th className="py-2">Pasajeros</th>
              <th className="py-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket) => {
              const trip = tripById.get(ticket.trip_id);
              const route = trip ? routeById.get(trip.route_id) : undefined;
              const boarding = stopById.get(ticket.boarding_stop_id);
              const alighting = stopById.get(ticket.alighting_stop_id);

              return (
                <tr key={ticket.id} className="border-b border-slate-100">
                  <td className="py-2 font-mono text-xs text-slate-700">
                    {ticket.ticket_number ?? "—"}
                  </td>
                  <td className="py-2 text-slate-900">
                    {new Date(ticket.created_at).toLocaleString("es-HN")}
                  </td>
                  <td className="py-2 text-slate-600">
                    {route?.name ?? "—"}
                  </td>
                  <td className="py-2 text-slate-600">
                    {boarding?.name ?? "?"} → {alighting?.name ?? "?"}
                  </td>
                  <td className="py-2 text-slate-600">
                    {ticket.passenger_count}
                  </td>
                  <td className="py-2 tabular-nums text-slate-900">
                    {new Intl.NumberFormat("es-HN", {
                      style: "currency",
                      currency: "HNL",
                    }).format(ticket.fare_amount * ticket.passenger_count)}
                  </td>
                </tr>
              );
            })}
            {tickets.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 text-center text-slate-400">
                  Aún no se han vendido boletos.
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
