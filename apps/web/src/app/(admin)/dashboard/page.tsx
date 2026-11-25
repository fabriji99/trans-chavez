import { createSupabaseServerClient } from "@/lib/supabase/server";
import { StatTile } from "@/components/StatTile";
import { RevenueBarChart } from "@/components/RevenueBarChart";
import { RevenueRangeChart, type DailyRevenue } from "@/components/RevenueRangeChart";
import Link from "next/link";
import { hondurasDay, isTripOverdue } from "@trans-chavez/shared";
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
  started_at: string | null;
  tickets: { fare_amount: number; passenger_count: number }[];
};

/** Viajes (con boletos) desde un día (YYYY-MM-DD, hora de Honduras) en adelante. */
async function loadSince(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  fromDay: string,
): Promise<MonthTrip[]> {
  const { data } = await supabase
    .from("trips")
    .select("id, route_id, cobrador_id, status, departure_at, started_at, tickets(fare_amount, passenger_count)")
    .gte("departure_at", `${fromDay}T00:00:00-06:00`)
    .limit(10000);
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
  // Datos desde el 1 del mes de hace 11 meses (para el rango "Año")
  const yearIdx = year * 12 + (month - 1) - 11;
  const rangeStart = `${Math.floor(yearIdx / 12)}-${pad((yearIdx % 12) + 1)}-01`;
  // Una sola consulta de los últimos 12 meses; mes actual y anterior se sacan de ahí
  const [recentTrips, cobradoresRes, routesRes, lastTicketsRes] = await Promise.all([
    loadSince(supabase, rangeStart),
    supabase.from("profiles").select("*").eq("role", "cobrador"),
    supabase.from("routes").select("*"),
    supabase
      .from("tickets")
      .select("id, trip_id, ticket_number, passenger_count, fare_amount, created_at, boarding_stop_id, alighting_stop_id")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const monthKey = `${year}-${pad(month)}`;
  const prevKey = `${prevYear}-${pad(prevMonth)}`;
  const monthTrips: MonthTrip[] = [];
  const prevTrips: MonthTrip[] = [];
  const revenueByDay = new Map<string, number>();
  for (const t of recentTrips) {
    const d = hondurasDay(t.departure_at);
    const key = d.slice(0, 7);
    if (key === monthKey) monthTrips.push(t);
    else if (key === prevKey) prevTrips.push(t);
    revenueByDay.set(d, (revenueByDay.get(d) ?? 0) + summarize([t]).revenue);
  }

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

  // Ingresos de cada día, desde hace 12 meses hasta el fin del mes en curso
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

  // --- Panel de control (hoy) ---
  const todaySummary = summarize(monthTrips.filter((t) => hondurasDay(t.departure_at) === today));
  const yesterdayRevenue = revenueByDay.get(addDays(today, -1)) ?? 0;
  const vsYesterday =
    yesterdayRevenue > 0 ? ((todaySummary.revenue - yesterdayRevenue) / yesterdayRevenue) * 100 : null;
  const inProgress = recentTrips.filter((t) => t.status === "in_progress");
  const overdueCount = inProgress.filter((t) => isTripOverdue(t)).length;
  const todayTrips = recentTrips
    .filter((t) => hondurasDay(t.departure_at) === today || t.status === "in_progress")
    .sort((a, b) => b.departure_at.localeCompare(a.departure_at));
  const hhmm = (iso: string) =>
    new Date(iso).toLocaleTimeString("es-HN", { timeZone: "America/Tegucigalpa", hour: "2-digit", minute: "2-digit", hour12: false });
  const todayLabel = new Intl.DateTimeFormat("es-HN", {
    timeZone: "America/Tegucigalpa",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  // Últimos boletos con su tramo, ruta y cobrador
  const lastTickets = (lastTicketsRes.data as {
    id: string; trip_id: string; ticket_number: string | null; passenger_count: number;
    fare_amount: number; created_at: string; boarding_stop_id: string; alighting_stop_id: string;
  }[] | null) ?? [];
  const stopIds = [...new Set(lastTickets.flatMap((t) => [t.boarding_stop_id, t.alighting_stop_id]))];
  const tripIds = [...new Set(lastTickets.map((t) => t.trip_id))];
  const [stopsRes, ticketTripsRes] = lastTickets.length
    ? await Promise.all([
        supabase.from("stops").select("id, name").in("id", stopIds),
        supabase.from("trips").select("id, cobrador_id").in("id", tripIds),
      ])
    : [{ data: [] }, { data: [] }];
  const stopName = new Map(((stopsRes.data as { id: string; name: string }[] | null) ?? []).map((x) => [x.id, x.name]));
  const tripCobrador = new Map(((ticketTripsRes.data as { id: string; cobrador_id: string }[] | null) ?? []).map((x) => [x.id, x.cobrador_id]));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900">Panel de control</h1>
          <p className="text-sm capitalize text-slate-500">{todayLabel}</p>
        </div>
        <Link
          href="/cobradores"
          className="rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700"
        >
          + Nuevo cobrador
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-start justify-between gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-sm font-extrabold text-blue-700">L</span>
            {vsYesterday !== null && (
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${vsYesterday >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                {vsYesterday >= 0 ? "+" : "−"}{Math.abs(vsYesterday).toFixed(0)}% vs. ayer
              </span>
            )}
          </div>
          <p className="mt-3 text-xs text-slate-500">Cobrado hoy</p>
          <p className="tabular font-display text-2xl font-extrabold tracking-tight text-slate-900">{money(todaySummary.revenue)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="3" /><path d="M2 10h20" /></svg>
          </span>
          <p className="mt-3 text-xs text-slate-500">Boletos emitidos hoy</p>
          <p className="tabular font-display text-2xl font-extrabold tracking-tight text-slate-900">{todaySummary.tickets}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime-50 text-lime-700">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
          </span>
          <p className="mt-3 text-xs text-slate-500">Pasajeros hoy</p>
          <p className="tabular font-display text-2xl font-extrabold tracking-tight text-slate-900">{todaySummary.passengers}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-start justify-between gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
            </span>
            {overdueCount > 0 && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800">{overdueCount} con alerta</span>
            )}
          </div>
          <p className="mt-3 text-xs text-slate-500">Viajes en curso</p>
          <p className="tabular font-display text-2xl font-extrabold tracking-tight text-slate-900">{inProgress.length}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5 lg:col-span-2">
          <h2 className="mb-4 font-display text-base font-extrabold text-slate-900">Ingresos por día</h2>
          <RevenueRangeChart daily={daily} today={today} />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-base font-extrabold text-slate-900">Viajes de hoy</h2>
            <Link href="/viajes" className="text-xs font-bold text-blue-700 hover:underline">Ver todos</Link>
          </div>
          <div className="space-y-2">
            {todayTrips.slice(0, 5).map((t) => {
              const overdue = isTripOverdue(t);
              return (
                <Link key={t.id} href={`/viajes/${t.id}`} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2.5 hover:bg-slate-100">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">{routeName.get(t.route_id) ?? "—"}</p>
                    <p className="truncate text-xs text-slate-500">{hhmm(t.departure_at)} · {cobradorName.get(t.cobrador_id) ?? "—"}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                    t.status !== "in_progress" ? "bg-slate-200 text-slate-600" : overdue ? "bg-amber-100 text-amber-800" : "bg-emerald-50 text-emerald-700"
                  }`}>
                    {t.status !== "in_progress" ? "Finalizado" : overdue ? "+45 min" : "En curso"}
                  </span>
                </Link>
              );
            })}
            {todayTrips.length === 0 && <p className="py-6 text-center text-sm text-slate-400">Hoy no hay viajes todavía.</p>}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-base font-extrabold text-slate-900">Últimos boletos</h2>
          <Link href="/boletos" className="text-xs font-bold text-blue-700 hover:underline">Ver todos los boletos</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-max text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-2">Boleto</th>
                <th className="py-2">Tramo</th>
                <th className="py-2 text-right">Pasajeros</th>
                <th className="py-2 text-right">Total</th>
                <th className="py-2 pl-6">Cobrador</th>
                <th className="py-2 text-right">Hora</th>
              </tr>
            </thead>
            <tbody>
              {lastTickets.map((k) => (
                <tr key={k.id} className="border-b border-slate-100">
                  <td className="py-2 font-mono text-xs font-bold text-slate-700">{k.ticket_number ?? "—"}</td>
                  <td className="py-2 text-slate-700">{stopName.get(k.boarding_stop_id) ?? "?"} → {stopName.get(k.alighting_stop_id) ?? "?"}</td>
                  <td className="py-2 text-right text-slate-600">{k.passenger_count}</td>
                  <td className="tabular py-2 text-right font-bold text-slate-900">{money(k.fare_amount * k.passenger_count)}</td>
                  <td className="py-2 pl-6 text-slate-700">{cobradorName.get(tripCobrador.get(k.trip_id) ?? "") ?? "—"}</td>
                  <td className="py-2 text-right text-slate-600">{hhmm(k.created_at)}</td>
                </tr>
              ))}
              {lastTickets.length === 0 && (
                <tr><td colSpan={6} className="py-4 text-center text-slate-400">Aún no se han vendido boletos.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div>
        <h2 className="font-display text-lg font-extrabold tracking-tight text-slate-900">Resumen de {MONTHS[month - 1]} {year}</h2>
        <p className="text-sm text-slate-500">Mes completo, del 1 al {daysInMonth}.</p>
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
