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
    <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-5">
      <p className="text-xs text-slate-500 sm:text-sm">{label}</p>
      <p className="mt-1 text-xl font-semibold sm:text-2xl text-slate-900">
        {isCurrency ? formatCompact(value) : value.toLocaleString("es-HN")}
      </p>
    </div>
  );
}
