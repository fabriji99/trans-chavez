function formatCompact(value: number): string {
  return new Intl.NumberFormat("es-HN", {
    style: "currency",
    currency: "HNL",
    maximumFractionDigits: 0,
  }).format(value);
}

export function StatTile({
  label,
  value,
  isCurrency = true,
}: {
  label: string;
  value: number;
  isCurrency?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-xs p-3 sm:p-5">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="tabular mt-1 font-display text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
        {isCurrency ? formatCompact(value) : value.toLocaleString("es-HN")}
      </p>
    </div>
  );
}
