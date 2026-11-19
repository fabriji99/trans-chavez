import { createSupabaseServerClient } from "@/lib/supabase/server";
import { StatTile } from "@/components/StatTile";
import { RevenueBarChart } from "@/components/RevenueBarChart";
import { hondurasDay } from "@trans-chavez/shared";
import type { Profile, Route } from "@trans-chavez/shared";

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const money = (value: number) =>
  new Intl.NumberFormat("es-HN", { style: "currency", currency: "HNL" }).format(value);

type MonthTrip = {
  id: string;
  route_id: string;
  cobrador_id: string;
  status: "in_progress" | "completed";
  departure_at: string;
  tickets: { fare_amount: number; passenger_count: number }[];
};

/** Viajes (con sus boletos) de un mes, en hora de Honduras (UTC-6, sin horario de verano). */
async function loadMonth(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  year: number,
  month: number, // 1-12
): Promise<MonthTrip[]> {
  const pad = (n: number) => String(n).padStart(2, "0");
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const { data } = await supabase
    .from("trips")
    .select("id, route_id, cobrador_id, status, departure_at, tickets(fare_amount, passenger_count)")
    .gte("departure_at", `${year}-${pad(month)}-01T00:00:00-06:00`)
    .lt("departure_at", `${nextYear}-${pad(nextMonth)}-01T00:00:00-06:00`)
    .limit(2000);
  return (data as unknown as MonthTrip[]) ?? [];
}

function summarize(trips: MonthTrip[]) {
  let revenue = 0;
  let tickets = 0;
  let passengers = 0;
  for (const t of trips) {
    for (const k of t.tickets) {
      revenue += k.fare_amount * k.passenger_count;
      passengers += k.passenger_count;
      tickets += 1;
    }
  }
  return { revenue, tickets, passengers, trips: trips.length };
}

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();

  // Todo el dashboard es del mes en curso: del día 1 hasta hoy (hora de Honduras)
  const today = hondurasDay(new Date());
  const [yearStr, monthStr, dayStr] = today.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const daysElapsed = Number(dayStr);
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;

  const [monthTrips, prevTrips, cobradoresRes, routesRes] = await Promise.all([
    loadMonth(supabase, year, month),
    loadMonth(supabase, prevYear, prevMonth),
    supabase.from("profiles").select("*").eq("role", "cobrador"),
    supabase.from("routes").select("*"),
  ]);

  const monthSummary = summarize(monthTrips);
  const totalToday = summarize(
    monthTrips.filter((t) => hondurasDay(t.departure_at) === today),
  ).revenue;
  const avgPerTrip = monthSummary.trips > 0 ? monthSummary.revenue / monthSummary.trips : 0;

  // Mes anterior, solo hasta el mismo día del mes para comparar lo mismo con lo mismo
  const prevSummary = summarize(
    prevTrips.filter((t) => Number(hondurasDay(t.departure_at).slice(8, 10)) <= daysElapsed),
  );
  const change =
    prevSummary.revenue > 0
      ? ((monthSummary.revenue - prevSummary.revenue) / prevSummary.revenue) * 100
      : null;

  // Ingresos de cada día del 1 hasta hoy (los días sin viajes cuentan como 0)
  const pad = (n: number) => String(n).padStart(2, "0");
  const byDay = Array.from({ length: daysElapsed }, (_, i) => {
    const day = `${year}-${pad(month)}-${pad(i + 1)}`;
    return {
      label: `${pad(i + 1)}-${MONTHS[month - 1].slice(0, 3)}`,
      total_revenue: summarize(monthTrips.filter((t) => hondurasDay(t.departure_at) === day)).revenue,
    };
  });

  const cobradorName = new Map(
    ((cobradoresRes.data as Profile[]) ?? []).map((c) => [c.id, c.full_name]),
  );
  const byCobrador = [...new Set(monthTrips.map((t) => t.cobrador_id))]
    .map((id) => ({
      id,
      name: cobradorName.get(id) ?? "—",
      ...summarize(monthTrips.filter((t) => t.cobrador_id === id)),
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const routeName = new Map(((routesRes.data as Route[]) ?? []).map((r) => [r.id, r.name]));
  const byRoute = [...new Set(monthTrips.map((t) => t.route_id))]
    .map((id) => ({
      id,
      name: routeName.get(id) ?? "—",
      ...summarize(monthTrips.filter((t) => t.route_id === id)),
    }))
    .sort((a, b) => b.revenue - a.revenue);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">
          Resumen de {MONTHS[month - 1]} {year}: del 1 al {daysElapsed}{" "}
          ({daysElapsed} {daysElapsed === 1 ? "día" : "días"}).
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="mb-4 text-xs text-slate-500">
          {change === null
            ? `Sin datos de ${MONTHS[prevMonth - 1]} para comparar`
            : `${change >= 0 ? "▲" : "▼"} ${Math.abs(change).toFixed(0)}% frente a los mismos ${daysElapsed} días de ${MONTHS[prevMonth - 1]} (${money(prevSummary.revenue)})`}
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <StatTile label="Ingresos de hoy" value={totalToday} />
          <StatTile label={`Ingresos (${daysElapsed} ${daysElapsed === 1 ? "día" : "días"})`} value={monthSummary.revenue} />
          <StatTile label="Viajes" value={monthSummary.trips} isCurrency={false} />
          <StatTile label="Boletos" value={monthSummary.tickets} isCurrency={false} />
          <StatTile label="Promedio por viaje" value={avgPerTrip} />
        </div>
        {byCobrador.length > 0 && (
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-2">Cobrador</th>
                <th className="py-2 text-right">Viajes</th>
                <th className="py-2 text-right">Boletos</th>
                <th className="py-2 text-right">Ingresos</th>
              </tr>
            </thead>
            <tbody>
              {byCobrador.map((c) => (
                <tr key={c.id} className="border-b border-slate-100">
                  <td className="py-2 text-slate-900">{c.name}</td>
                  <td className="py-2 text-right text-slate-600">{c.trips}</td>
                  <td className="py-2 text-right text-slate-600">{c.tickets}</td>
                  <td className="py-2 text-right tabular-nums text-slate-900">{money(c.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-medium text-slate-700">Ingresos por día</h2>
        <RevenueBarChart data={byDay} />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-medium text-slate-700">Ingresos por ruta</h2>
        <RevenueBarChart
          data={byRoute.map((r) => ({ label: r.name, total_revenue: r.revenue }))}
        />
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2">Ruta</th>
              <th className="py-2">Viajes</th>
              <th className="py-2">Boletos</th>
              <th className="py-2">Ingresos</th>
            </tr>
          </thead>
          <tbody>
            {byRoute.map((r) => (
              <tr key={r.id} className="border-b border-slate-100">
                <td className="py-2 text-slate-900">{r.name}</td>
                <td className="py-2 text-slate-600">{r.trips}</td>
                <td className="py-2 text-slate-600">{r.tickets}</td>
                <td className="py-2 tabular-nums text-slate-900">{money(r.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
