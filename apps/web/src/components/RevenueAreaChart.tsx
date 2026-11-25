"use client";

import { useId } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RevenueBarDatum } from "./RevenueBarChart";

const currency = (value: number) =>
  new Intl.NumberFormat("es-HN", { style: "currency", currency: "HNL", maximumFractionDigits: 0 }).format(value);

/** Gráfica de área (línea con relleno) de ingresos, estilo del panel de control. */
export function RevenueAreaChart({ data }: { data: RevenueBarDatum[] }) {
  const gradientId = useId().replace(/:/g, "");
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">Aún no hay datos de ingresos.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-series-1)" stopOpacity={0.28} />
            <stop offset="100%" stopColor="var(--chart-series-1)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
        <XAxis
          dataKey="label"
          interval="preserveStartEnd"
          minTickGap={20}
          tick={{ fill: "var(--chart-ink-muted)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "var(--chart-ink-muted)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={56}
          tickFormatter={(v) => currency(Number(v))}
        />
        <Tooltip
          formatter={(value: number) => currency(value)}
          contentStyle={{
            background: "#0e2a47",
            border: "none",
            borderRadius: 10,
            fontSize: 12,
            color: "#fff",
          }}
          labelStyle={{ color: "#b8ccc8" }}
          itemStyle={{ color: "#fff" }}
        />
        <Area
          type="monotone"
          dataKey="total_revenue"
          name="Ingresos"
          stroke="var(--chart-series-1)"
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={{ r: 3, fill: "#fff", stroke: "var(--chart-series-1)", strokeWidth: 2 }}
          activeDot={{ r: 5, fill: "var(--chart-series-1)" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
