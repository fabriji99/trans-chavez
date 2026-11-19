"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface RevenueBarDatum {
  label: string;
  total_revenue: number;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-HN", {
    style: "currency",
    currency: "HNL",
    maximumFractionDigits: 0,
  }).format(value);
}

export function RevenueBarChart({ data }: { data: RevenueBarDatum[] }) {
  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-400">
        Aún no hay datos de ingresos.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid
          vertical={false}
          stroke="var(--chart-grid)"
          strokeDasharray="0"
        />
        <XAxis
          dataKey="label"
          tick={{ fill: "var(--chart-ink-muted)", fontSize: 12 }}
          axisLine={{ stroke: "var(--chart-baseline)" }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "var(--chart-ink-muted)", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={64}
          tickFormatter={(v) => formatCurrency(Number(v))}
        />
        <Tooltip
          formatter={(value: number) => formatCurrency(value)}
          contentStyle={{
            background: "var(--chart-surface)",
            border: "1px solid var(--chart-grid)",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: "var(--chart-ink-secondary)" }}
        />
        <Bar
          dataKey="total_revenue"
          name="Ingresos"
          fill="var(--chart-series-1)"
          radius={[4, 4, 0, 0]}
          maxBarSize={24}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
