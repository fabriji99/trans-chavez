import Link from "next/link";
import { requireCobrador } from "@/lib/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hondurasDay, isTripOverdue, TRIP_OPEN_ALERT_MINUTES } from "@trans-chavez/shared";
import type { Bus, Route, Ticket, Trip } from "@trans-chavez/shared";

const TZ = "America/Tegucigalpa";
const money = (n: number) => `L ${n.toFixed(2)}`;

export default async function CobradorHome() {
  const profile = await requireCobrador();
  const supabase = await createSupabaseServerClient();

  const { data: tripData } = await supabase
    .from("trips")
    .select("*")
    .eq("cobrador_id", profile.id)
    .order("departure_at", { ascending: false })
    .limit(40);
  const today = hondurasDay(new Date());
  const trips = ((tripData as Trip[] | null) ?? []).filter(
    (t) => t.status === "in_progress" || hondurasDay(t.departure_at) === today,
  );

  const [{ data: routeData }, { data: busData }, { data: ticketData }] = await Promise.all([
    supabase.from("routes").select("*"),
    supabase.from("buses").select("*"),
    trips.length
      ? supabase
          .from("tickets")
          .select("trip_id, passenger_count, fare_amount")
          .in("trip_id", trips.map((t) => t.id))
      : Promise.resolve({ data: [] }),
  ]);
  const routeById = new Map(((routeData as Route[] | null) ?? []).map((r) => [r.id, r]));
  const busById = new Map(((busData as Bus[] | null) ?? []).map((b) => [b.id, b]));

  const stats = new Map<string, { count: number; total: number }>();
  for (const t of (ticketData as Pick<Ticket, "trip_id" | "passenger_count" | "fare_amount">[] | null) ?? []) {
    const s = stats.get(t.trip_id) ?? { count: 0, total: 0 };
    s.count += 1;
    s.total += t.fare_amount * t.passenger_count;
    stats.set(t.trip_id, s);
  }

  const inProgress = trips.find((t) => t.status === "in_progress");

  return (
    <div>
      <h1 className="font-display text-lg font-bold text-slate-900">Hola, {profile.full_name}</h1>
      <p className="mb-4 text-sm text-slate-500">Tus viajes de hoy</p>

      {inProgress ? (
        <Link
          href={`/cobrador/viaje/${inProgress.id}`}
          className="mb-4 block min-h-[54px] rounded-2xl bg-blue-600 px-4 py-4 text-center font-display text-base font-bold text-white shadow-lg shadow-blue-600/25 active:scale-[0.99]"
        >
          Seguir cobrando el viaje en curso
        </Link>
      ) : (
        <Link
          href="/cobrador/iniciar"
          className="mb-4 block min-h-[54px] rounded-2xl bg-blue-600 px-4 py-4 text-center font-display text-base font-bold text-white shadow-lg shadow-blue-600/25 active:scale-[0.99]"
        >
          Iniciar viaje
        </Link>
      )}

      <div className="space-y-3">
        {trips.length === 0 && (
          <p className="py-10 text-center text-sm text-slate-400">
            Hoy no tienes viajes. Toca &quot;Iniciar viaje&quot;.
          </p>
        )}
        {trips.map((trip) => {
          const route = routeById.get(trip.route_id);
          const s = stats.get(trip.id) ?? { count: 0, total: 0 };
          return (
            <Link
              key={trip.id}
              href={`/cobrador/viaje/${trip.id}`}
              className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-xs"
            >
              <p className="font-display font-bold text-slate-900">{route?.name ?? "—"}</p>
              <p className="mt-0.5 text-sm text-slate-500">
                Bus {busById.get(trip.bus_id)?.plate ?? "—"} ·{" "}
                {new Date(trip.departure_at).toLocaleTimeString("es-HN", {
                  timeZone: TZ,
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                {trip.status === "in_progress" ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                    En curso
                    {isTripOverdue(trip) ? ` · más de ${TRIP_OPEN_ALERT_MINUTES} min` : ""}
                  </span>
                ) : (
                  <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                    Finalizado · ver boletos
                  </span>
                )}
                <span className="tabular font-semibold text-slate-700">
                  {s.count} {s.count === 1 ? "boleto" : "boletos"} · {money(s.total)}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
