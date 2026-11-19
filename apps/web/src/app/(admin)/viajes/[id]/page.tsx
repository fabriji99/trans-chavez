import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  directionLabel,
  hondurasDay,
  isTripOverdue,
  minutesOpen,
  missingSeqs,
  ticketPrefix,
  ticketSeq,
  TRIP_OPEN_ALERT_MINUTES,
} from "@trans-chavez/shared";
import type { Bus, Driver, Profile, Route, Stop, Ticket, Trip } from "@trans-chavez/shared";

const STATUS_LABEL: Record<Trip["status"], string> = {
  in_progress: "En curso",
  completed: "Finalizado",
};

const money = (value: number) =>
  new Intl.NumberFormat("es-HN", { style: "currency", currency: "HNL" }).format(value);

export default async function ViajeDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: tripData } = await supabase.from("trips").select("*").eq("id", id).maybeSingle();
  if (!tripData) notFound();
  const trip = tripData as Trip;

  const [ticketsRes, routeRes, stopsRes, busRes, cobradorRes, driverRes] = await Promise.all([
    supabase.from("tickets").select("*").eq("trip_id", id).order("created_at", { ascending: false }),
    supabase.from("routes").select("*").eq("id", trip.route_id).single(),
    supabase.from("stops").select("*").eq("route_id", trip.route_id),
    supabase.from("buses").select("*").eq("id", trip.bus_id).maybeSingle(),
    supabase.from("profiles").select("*").eq("id", trip.cobrador_id).maybeSingle(),
    trip.driver_id
      ? supabase.from("drivers").select("*").eq("id", trip.driver_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const tickets = (ticketsRes.data as Ticket[]) ?? [];
  const route = routeRes.data as Route;
  const stopById = new Map(((stopsRes.data as Stop[]) ?? []).map((s) => [s.id, s]));
  const bus = busRes.data as Bus | null;
  const cobrador = cobradorRes.data as Profile | null;
  const driver = driverRes.data as Driver | null;

  // Control de numeración: boletos del cobrador ese día y consecutivos que faltan
  let missing: number[] = [];
  let missingPrefix = "";
  if (cobrador?.code) {
    missingPrefix = ticketPrefix(cobrador.code, hondurasDay(trip.departure_at));
    const { data: dayRows } = await supabase
      .from("tickets")
      .select("ticket_number")
      .like("ticket_number", `${missingPrefix}-%`);
    const seqs = ((dayRows as { ticket_number: string }[]) ?? [])
      .map((r) => ticketSeq(r.ticket_number, missingPrefix))
      .filter((n): n is number => n !== null);
    missing = missingSeqs(seqs);
  }

  const passengers = tickets.reduce((n, t) => n + t.passenger_count, 0);
  const total = tickets.reduce((n, t) => n + t.fare_amount * t.passenger_count, 0);

  const TZ = "America/Tegucigalpa";
  const fmt = (iso: string) => new Date(iso).toLocaleString("es-HN", { timeZone: TZ });
  // Minutos entre que el cobrador finalizó y el servidor recibió el viaje
  const syncDelay =
    trip.ended_at && trip.synced_at
      ? Math.round((new Date(trip.synced_at).getTime() - new Date(trip.ended_at).getTime()) / 60_000)
      : null;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/viajes" className="text-sm text-slate-500 hover:underline">
          ‹ Viajes
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-slate-900">
          {directionLabel(route, trip.direction)}
        </h1>
        <p className="text-sm text-slate-500">
          {new Date(trip.departure_at).toLocaleString("es-HN", { timeZone: "America/Tegucigalpa" })} · Bus {bus?.plate ?? "—"} ·
          Cobrador {cobrador?.full_name ?? "—"} · Chofer {driver?.full_name ?? "—"} ·{" "}
          {STATUS_LABEL[trip.status]}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {trip.started_at ? `Iniciado ${fmt(trip.started_at)}` : ""}
          {trip.ended_at ? ` · Finalizado ${fmt(trip.ended_at)}` : ""}
          {trip.synced_at ? ` · Sincronizado ${fmt(trip.synced_at)}` : " · Sin hora de sincronización"}
          {syncDelay !== null && syncDelay > 0 ? ` (${syncDelay} min después de finalizar)` : ""}
        </p>
        {isTripOverdue(trip) && (
          <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            Este viaje lleva {minutesOpen(trip)} min abierto (límite {TRIP_OPEN_ALERT_MINUTES} min).
          </p>
        )}
      </div>

      {missing.length > 0 && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Faltan boletos en la numeración de {cobrador?.full_name} ese día:{" "}
          {missing.map((n) => `${missingPrefix}-${String(n).padStart(4, "0")}`).join(", ")}. Pueden ser
          boletos aún sin sincronizar o cobros sin registrar.
        </p>
      )}

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {[
          { label: "Boletos", value: String(tickets.length) },
          { label: "Pasajeros", value: String(passengers) },
          { label: "Total cobrado", value: money(total) },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
            <p className="text-xs text-slate-500">{stat.label}</p>
            <p className="mt-1 text-base font-semibold text-slate-900 sm:text-xl">{stat.value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="overflow-x-auto">
<table className="w-full min-w-max text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2">N.º boleto</th>
              <th className="py-2">Hora</th>
              <th className="py-2">Sube en</th>
              <th className="py-2">Baja en</th>
              <th className="py-2 text-right">Pasajeros</th>
              <th className="py-2 text-right">Precio c/u</th>
              <th className="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((t) => (
              <tr key={t.id} className="border-b border-slate-100">
                <td className="py-2 font-mono text-xs text-slate-700">{t.ticket_number ?? "—"}</td>
                <td className="py-2 text-slate-900">
                  {new Date(t.created_at).toLocaleTimeString("es-HN", {
                    timeZone: "America/Tegucigalpa",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td className="py-2 text-slate-600">{stopById.get(t.boarding_stop_id)?.name ?? "—"}</td>
                <td className="py-2 text-slate-600">{stopById.get(t.alighting_stop_id)?.name ?? "—"}</td>
                <td className="py-2 text-right text-slate-600">{t.passenger_count}</td>
                <td className="py-2 text-right text-slate-600">{money(t.fare_amount)}</td>
                <td className="py-2 text-right text-slate-900">
                  {money(t.fare_amount * t.passenger_count)}
                </td>
              </tr>
            ))}
            {tickets.length === 0 && (
              <tr>
                <td colSpan={7} className="py-4 text-center text-slate-400">
                  Este viaje aún no tiene boletos.
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
