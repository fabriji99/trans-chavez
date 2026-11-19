import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createBus, deleteBus } from "@/lib/actions/buses";
import type { Bus } from "@trans-chavez/shared";

export default async function BusesPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("buses").select("*").order("plate");
  const buses = (data as Bus[]) ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-lg font-bold text-slate-900">Buses</h1>
        <p className="text-sm text-slate-500">Flota de unidades disponibles.</p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-xs p-4 sm:p-5">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Nuevo bus</h2>
        <form action={createBus} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input
            name="plate"
            placeholder="Placa"
            required
            className="rounded-xl border border-slate-200 bg-slate-50 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 px-3 py-2 text-sm"
          />
          <input
            name="name"
            placeholder="Nombre / alias (opcional)"
            className="rounded-xl border border-slate-200 bg-slate-50 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 px-3 py-2 text-sm"
          />
          <input
            name="capacity"
            type="number"
            min={1}
            defaultValue={40}
            placeholder="Capacidad"
            className="rounded-xl border border-slate-200 bg-slate-50 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="col-span-1 rounded-xl bg-blue-600 px-4 py-2.5 font-display text-sm font-bold text-white shadow-md shadow-blue-600/20 hover:bg-blue-700 sm:col-span-3 sm:w-fit"
          >
            Crear bus
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-xs p-4 sm:p-5">
        <div className="overflow-x-auto">
<table className="w-full min-w-max text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <th className="py-2">Placa</th>
              <th className="py-2">Nombre</th>
              <th className="py-2">Capacidad</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {buses.map((bus) => (
              <tr key={bus.id} className="border-b border-slate-100">
                <td className="py-2 text-slate-900">{bus.plate}</td>
                <td className="py-2 text-slate-600">{bus.name ?? "—"}</td>
                <td className="py-2 text-slate-600">{bus.capacity}</td>
                <td className="py-2 text-right">
                  <form action={deleteBus}>
                    <input type="hidden" name="id" value={bus.id} />
                    <button
                      type="submit"
                      className="text-xs text-red-600 hover:underline"
                    >
                      Eliminar
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {buses.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-center text-slate-400">
                  Aún no hay buses registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
</div>
      </section>
    </div>
  );
}
