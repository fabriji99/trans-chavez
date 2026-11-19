import { hondurasDay } from "@trans-chavez/shared";

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export default function RespaldosPage() {
  const [y, m] = hondurasDay(new Date()).split("-").map(Number);
  // Mes actual y los 11 anteriores
  const months = Array.from({ length: 12 }, (_, i) => {
    const index = y * 12 + (m - 1) - i;
    const year = Math.floor(index / 12);
    const month = (index % 12) + 1;
    return {
      value: `${year}-${String(month).padStart(2, "0")}`,
      label: `${MONTHS[month - 1]} ${year}`,
    };
  });

  const linkClass =
    "rounded-xl border border-slate-200 bg-slate-50 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-lg font-bold text-slate-900">Respaldos</h1>
        <p className="text-sm text-slate-500">
          Descarga los viajes y boletos de un mes en un archivo que abre en Excel. Se recomienda
          descargar el del mes anterior los primeros días de cada mes y guardarlo fuera del sistema.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-xs p-4 sm:p-5">
        <div className="overflow-x-auto">
<table className="w-full min-w-max text-sm">
          <tbody>
            {months.map((month) => (
              <tr key={month.value} className="border-b border-slate-100">
                <td className="py-2 text-slate-900">{month.label}</td>
                <td className="py-2 text-right">
                  <a href={`/api/respaldo?mes=${month.value}`} className={linkClass}>
                    Descargar
                  </a>
                </td>
              </tr>
            ))}
            <tr>
              <td className="py-2 font-medium text-slate-900">Todo el historial</td>
              <td className="py-2 text-right">
                <a href="/api/respaldo?mes=todo" className={linkClass}>
                  Descargar
                </a>
              </td>
            </tr>
          </tbody>
        </table>
</div>
      </section>
    </div>
  );
}
