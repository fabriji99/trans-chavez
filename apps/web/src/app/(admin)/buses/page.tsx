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
        <h1 className="text-lg font-semibold text-slate-900">Buses</h1>
        <p className="text-sm text-slate-500">Flota de unidades disponibles.</p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-medium text-slate-700">Nuevo bus</h2>
        <form action={createBus} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input
            name="plate"
            placeholder="Placa"
            required
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            name="name"
            placeholder="Nombre / alias (opcional)"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            name="capacity"
            type="number"
            min={1}
            defaultValue={40}
            placeholder="Capacidad"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="col-span-1 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 sm:col-span-3 sm:w-fit"
          >
            Crear bus
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
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
      </section>
    </div>
  );
}
