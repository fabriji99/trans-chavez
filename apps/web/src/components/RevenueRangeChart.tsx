"use client";

import { useState } from "react";
import { RevenueAreaChart } from "./RevenueAreaChart";

export interface DailyRevenue {
  /** Día YYYY-MM-DD (hora de Honduras). */
  date: string;
  label: string;
  total_revenue: number;
}

type RangeKey = "week" | "month" | "quarter" | "semester" | "year";

const RANGES: { key: RangeKey; label: string; hint: string }[] = [
  { key: "week", label: "Semana", hint: "últimos 7 días" },
  { key: "month", label: "Mes", hint: "por día" },
  { key: "quarter", label: "Trimestre", hint: "últimas 13 semanas" },
  { key: "semester", label: "Semestre", hint: "últimos 6 meses" },
  { key: "year", label: "Año", hint: "últimos 12 meses" },
];

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const money = (n: number) =>
  new Intl.NumberFormat("es-HN", { style: "currency", currency: "HNL" }).format(n);

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Suma por mes calendario de los últimos `count` meses (incluye el mes en curso). */
function byMonth(daily: DailyRevenue[], today: string, count: number) {
  const [y, m] = today.split("-").map(Number);
  const out: { label: string; total_revenue: number }[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const idx = y * 12 + (m - 1) - i;
    const yy = Math.floor(idx / 12);
    const mm = idx % 12;
    const key = `${yy}-${String(mm + 1).padStart(2, "0")}`;
    out.push({
      label: `${MONTHS[mm]}-${String(yy).slice(2)}`,
      total_revenue: daily.filter((d) => d.date.slice(0, 7) === key).reduce((n, d) => n + d.total_revenue, 0),
    });
  }
  return out;
}

/** Suma por bloques de 7 días, las últimas `count` semanas terminando hoy. */
function byWeek(daily: DailyRevenue[], today: string, count: number) {
  const out: { label: string; total_revenue: number }[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const end = addDays(today, -7 * i);
    const start = addDays(end, -6);
    const [, m, d] = start.split("-");
    out.push({
      label: `${d}-${MONTHS[Number(m) - 1]}`,
      total_revenue: daily
        .filter((x) => x.date >= start && x.date <= end)
        .reduce((n, x) => n + x.total_revenue, 0),
    });
  }
  return out;
}

/** Gráfica de ingresos por día con selector de rango (semana, 15 días, mes, 3 meses). */
export function RevenueRangeChart({
  daily,
  today,
}: {
  daily: DailyRevenue[];
  today: string;
}) {
  const [range, setRange] = useState<RangeKey>("month");

  const upToToday = daily.filter((d) => d.date <= today);
  let data: { label: string; total_revenue: number }[];
  if (range === "week") data = upToToday.slice(-7);
  else if (range === "month") data = daily.filter((d) => d.date.slice(0, 7) === today.slice(0, 7));
  else if (range === "quarter") data = byWeek(daily, today, 13);
  else if (range === "semester") data = byMonth(daily, today, 6);
  else data = byMonth(daily, today, 12);

  const total = data.reduce((n, d) => n + d.total_revenue, 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-2xl bg-slate-100 p-1" role="tablist" aria-label="Rango de la gráfica">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              role="tab"
              aria-selected={range === r.key}
              onClick={() => setRange(r.key)}
              className={`min-h-9 rounded-xl px-3 text-xs font-bold transition-colors ${
                range === r.key
                  ? "bg-white text-blue-700 shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <p className="tabular text-sm text-slate-500">
          {RANGES.find((r) => r.key === range)?.hint} · Total: <span className="font-bold text-slate-900">{money(total)}</span>
        </p>
      </div>
      <RevenueAreaChart data={data} />
    </div>
  );
}
