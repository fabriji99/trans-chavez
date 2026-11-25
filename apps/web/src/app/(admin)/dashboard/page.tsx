import { createSupabaseServerClient } from "@/lib/supabase/server";
import { StatTile } from "@/components/StatTile";
import { RevenueBarChart } from "@/components/RevenueBarChart";
import { RevenueRangeChart, type DailyRevenue } from "@/components/RevenueRangeChart";
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

/** Viajes (con boletos) desde un día (YYYY-MM-DD, hora de Honduras) en adelante. */
async function loadSince(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  fromDay: string,
): Promise<MonthTrip[]> {
  const { data } = await supabase
    .from("trips")
    .select("id, route_id, cobrador_id, status, departure_at, tickets(fare_amount, passenger_count)")
    .gte("departure_at", `${fromDay}T00:00:00-06:00`)
    .limit(5000);
  return (data as unknown as MonthTrip[]) ?? [];
}

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
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

  // Todo el dashboard es del mes completo en curso (hora de Honduras)
  const today = hondurasDay(new Date());
  const [yearStr, monthStr] = today.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const daysInMonth = new Date(year, month, 0).getDate();
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;

  const pad = (n: number) => String(n).padStart(2, "0");
  const monthStart = `${year}-${pad(month)}-01`;
  const rangeStart = addDays(today, -89) < monthStart ? addDays(today, -89) : monthStart;
  const [monthTrips, prevTrips, recentTrips, cobradoresRes, routesRes] = await Promise.all([
    loadMonth(supabase, year, month),
    loadMonth(supabase, prevYear, prevMonth),
    loadSince(supabase, rangeStart),
    supabase.from("profiles").select("*").eq("role", "cobrador"),
    supabase.from("routes").select("*"),
  ]);

  const monthSummary = summarize(monthTrips);
  const totalToday = summarize(
    monthTrips.filter((t) => hondurasDay(t.departure_at) === today),
  ).revenue;
  const avgPerTrip = monthSummary.trips > 0 ? monthSummary.revenue / monthSummary.trips : 0;

  // Mes anterior completo, para comparar mes contra mes
  const prevSummary = summarize(prevTrips);
  const change =
    prevSummary.revenue > 0
      ? ((monthSummary.revenue - prevSummary.revenue) / prevSummary.revenue) * 100
      : null;

  // Ingresos de cada día, desde hace 90 días (o el 1 del mes) hasta el fin del mes en curso
  const revenueByDay = new Map<string, number>();
  for (const t of recentTrips) {
    const d = hondurasDay(t.departure_at);
    revenueByDay.set(d, (revenueByDay.get(d) ?? 0) + summarize([t]).revenue);
  }
  const lastDay = `${year}-${pad(month)}-${pad(daysInMonth)}`;
  const daily: DailyRevenue[] = [];
  for (let d = rangeStart; d <= lastDay; d = addDays(d, 1)) {
    const [, m, dd] = d.split("-");
    daily.push({
      date: d,
      label: `${dd}-${MONTHS[Number(m) - 1].slice(0, 3)}`,
      total_revenue: revenueByDay.get(d) ?? 0,
    });
  }

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
        <h1 className="font-display text-lg font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">
          Resumen de {MONTHS[month - 1]} {year}: mes completo, del 1 al {daysInMonth}.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-xs p-4 sm:p-5">
        <p className="mb-4 text-xs text-slate-500">
          {change === null
            ? `Sin datos de ${MONTHS[prevMonth - 1]} para comparar`
            : `${change >= 0 ? "▲" : "▼"} ${Math.abs(change).toFixed(0)}% frente a todo ${MONTHS[prevMonth - 1]} (${money(prevSummary.revenue)})`}
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <StatTile label="Ingresos de hoy" value={totalToday} />
          <StatTile label="Ingresos del mes" value={monthSummary.revenue} />
          <StatTile label="Viajes" value={monthSummary.trips} isCurrency={false} />
          <StatTile label="Boletos" value={monthSummary.tickets} isCurrency={false} />
          <StatTile label="Promedio por viaje" value={avgPerTrip} />
        </div>
        {byCobrador.length > 0 && (
          <div className="overflow-x-auto">
<table className="mt-4 w-full min-w-max text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
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
</div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-xs p-4 sm:p-5">
        <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500">Ingresos por día</h2>
        <RevenueRangeChart daily={daily} today={today} />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-xs p-4 sm:p-5">
        <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500">Ingresos por ruta</h2>
        <RevenueBarChart
          data={byRoute.map((r) => ({ label: r.name, total_revenue: r.revenue }))}
        />
        <div className="overflow-x-auto">
<table className="mt-4 w-full min-w-max text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
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
</div>
      </section>
    </div>
  );
}
