import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCobrador } from "@/lib/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TicketPanel } from "@/components/TicketPanel";
import { FinishTripButton } from "@/components/FinishTripButton";
import {
  directionLabel,
  isTripOverdue,
  orderStopsForDirection,
  TRIP_OPEN_ALERT_MINUTES,
} from "@trans-chavez/shared";
import type { Route, Stop, StopPrice, Ticket, Trip } from "@trans-chavez/shared";

const TZ = "America/Tegucigalpa";
const money = (n: number) => `L ${n.toFixed(2)}`;

export default async function ViajePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireCobrador();
  const supabase = await createSupabaseServerClient();

  const { data: tripData } = await supabase.from("trips").select("*").eq("id", id).single();
  const trip = tripData as Trip | null;
  if (!trip || trip.cobrador_id !== profile.id) notFound();

  const [{ data: routeData }, { data: stopData }, { data: ticketData }] = await Promise.all([
    supabase.from("routes").select("*").eq("id", trip.route_id).single(),
    supabase.from("stops").select("*").eq("route_id", trip.route_id).eq("active", true),
    supabase.from("tickets").select("*").eq("trip_id", trip.id).order("created_at", { ascending: false }),
  ]);
  const route = routeData as Route;
  const stops = (stopData as Stop[] | null) ?? [];
  const tickets = (ticketData as Ticket[] | null) ?? [];

  const { data: priceData } = await supabase
    .from("stop_prices")
    .select("*")
    .in("stop_id", stops.map((s) => s.id));
  const stopPrices = (priceData as StopPrice[] | null) ?? [];

  const stopName = new Map(stops.map((s) => [s.id, s.name]));
  const total = tickets.reduce((n, t) => n + t.fare_amount * t.passenger_count, 0);
  const passengers = tickets.reduce((n, t) => n + t.passenger_count, 0);
  const inProgress = trip.status === "in_progress";

  return (
    <div>
      <Link href="/cobrador" className="text-sm text-blue-600">
        ‹ Viajes
      </Link>
      <h1 className="mt-2 text-lg font-semibold text-slate-900">{directionLabel(route, trip.direction)}</h1>
      <p className="mb-4 text-sm text-slate-500">
        {inProgress ? "En curso" : "Finalizado"} ·{" "}
        {new Date(trip.departure_at).toLocaleTimeString("es-HN", { timeZone: TZ, hour: "2-digit", minute: "2-digit" })}
      </p>

      {inProgress && isTripOverdue(trip) && (
        <div className="mb-4 rounded-lg border border-red-400 bg-red-50 p-3 text-sm font-semibold text-red-800">
          Este viaje lleva más de {TRIP_OPEN_ALERT_MINUTES} minutos abierto. Si ya terminó, finalízalo.
        </div>
      )}

      {inProgress && (
        <TicketPanel
          tripId={trip.id}
          direction={trip.direction}
          stops={orderStopsForDirection(stops, trip.direction)}
          stopPrices={stopPrices}
        />
      )}

      <div className="mt-8 grid grid-cols-3 gap-2">
        {[
          { label: "Boletos", value: String(tickets.length) },
          { label: "Pasajeros", value: String(passengers) },
          { label: "Cobrado", value: money(total) },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-3 text-center">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className="mt-1 text-base font-semibold text-slate-900">{s.value}</p>
          </div>
        ))}
      </div>

      <h2 className="mb-2 mt-6 text-sm font-semibold text-slate-700">Boletos del viaje</h2>
      <div className="space-y-2">
        {tickets.length === 0 && <p className="py-4 text-center text-sm text-slate-400">Aún no hay boletos.</p>}
        {tickets.map((t) => (
          <div key={t.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
            <div className="flex justify-between">
              <span className="font-medium text-slate-900">{t.ticket_number ?? "—"}</span>
              <span className="font-semibold text-slate-900">{money(t.fare_amount * t.passenger_count)}</span>
            </div>
            <p className="mt-0.5 text-slate-500">
              {stopName.get(t.boarding_stop_id) ?? "—"} → {stopName.get(t.alighting_stop_id) ?? "—"} ·{" "}
              {t.passenger_count} {t.passenger_count === 1 ? "pasajero" : "pasajeros"} ·{" "}
              {new Date(t.created_at).toLocaleTimeString("es-HN", { timeZone: TZ, hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        ))}
      </div>

      {inProgress && (
        <div className="mt-8">
          <FinishTripButton tripId={trip.id} />
        </div>
      )}
    </div>
  );
}
