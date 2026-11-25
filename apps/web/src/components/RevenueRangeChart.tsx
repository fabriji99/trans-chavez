"use client";

import { useState } from "react";
import { RevenueBarChart } from "./RevenueBarChart";

export interface DailyRevenue {
  /** Día YYYY-MM-DD (hora de Honduras). */
  date: string;
  label: string;
  total_revenue: number;
}

type RangeKey = "7" | "15" | "month" | "90";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "7", label: "7 días" },
  { key: "15", label: "15 días" },
  { key: "month", label: "Mes" },
  { key: "90", label: "3 meses" },
];

const money = (n: number) =>
  new Intl.NumberFormat("es-HN", { style: "currency", currency: "HNL" }).format(n);

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
  const data =
    range === "month"
      ? daily.filter((d) => d.date.slice(0, 7) === today.slice(0, 7))
      : upToToday.slice(-Number(range));

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
          Total del rango: <span className="font-bold text-slate-900">{money(total)}</span>
        </p>
      </div>
      <RevenueBarChart data={data.map((d) => ({ label: d.label, total_revenue: d.total_revenue }))} />
    </div>
  );
}
