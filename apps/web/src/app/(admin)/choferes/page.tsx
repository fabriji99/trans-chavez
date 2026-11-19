import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createDriver, deleteDriver } from "@/lib/actions/drivers";
import type { Driver } from "@trans-chavez/shared";

export default async function ChoferesPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("drivers").select("*").order("full_name");
  const drivers = (data as Driver[]) ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-lg font-bold text-slate-900">Choferes</h1>
        <p className="text-sm text-slate-500">
          Los cobradores eligen uno de estos choferes al iniciar un viaje.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-xs p-4 sm:p-5">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
          Registrar chofer
        </h2>
        <form
          action={createDriver}
          className="grid grid-cols-1 gap-3 sm:grid-cols-3"
        >
          <input
            name="full_name"
            placeholder="Nombre completo"
            required
            className="rounded-xl border border-slate-200 bg-slate-50 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 px-3 py-2 text-sm"
          />
          <input
            name="phone"
            placeholder="Teléfono (opcional)"
            className="rounded-xl border border-slate-200 bg-slate-50 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-xl bg-blue-600 px-4 py-2.5 font-display text-sm font-bold text-white shadow-md shadow-blue-600/20 hover:bg-blue-700"
          >
            Registrar chofer
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-xs p-4 sm:p-5">
        <div className="overflow-x-auto">
<table className="w-full min-w-max text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <th className="py-2">Nombre</th>
              <th className="py-2">Teléfono</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {drivers.map((d) => (
              <tr key={d.id} className="border-b border-slate-100">
                <td className="py-2 text-slate-900">{d.full_name}</td>
                <td className="py-2 text-slate-600">{d.phone ?? "—"}</td>
                <td className="py-2 text-right">
                  <form action={deleteDriver}>
                    <input type="hidden" name="id" value={d.id} />
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
            {drivers.length === 0 && (
              <tr>
                <td colSpan={3} className="py-4 text-center text-slate-400">
                  Aún no hay choferes registrados.
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
