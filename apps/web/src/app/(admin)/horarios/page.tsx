import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSchedule, deleteSchedule } from "@/lib/actions/horarios";
import { directionLabel, SCHEDULE_TOLERANCE_MINUTES } from "@trans-chavez/shared";
import type { Route, RouteSchedule } from "@trans-chavez/shared";

export default async function HorariosPage() {
  const supabase = await createSupabaseServerClient();
  const [{ data: routeData }, { data: scheduleData }] = await Promise.all([
    supabase.from("routes").select("*").eq("active", true).order("name"),
    supabase.from("route_schedules").select("*").order("depart_time"),
  ]);
  const routes = (routeData as Route[] | null) ?? [];
  const schedules = (scheduleData as RouteSchedule[] | null) ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-lg font-bold text-slate-900">Horarios de salida</h1>
        <p className="text-sm text-slate-500">
          Al abrir un viaje se guarda la hora real y se asigna al horario más cercano, siempre que
          esté a menos de {SCHEDULE_TOLERANCE_MINUTES} minutos. Si no hay ninguno cerca, el viaje queda
          sin horario asignado.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-xs p-4 sm:p-5">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Nuevo horario</h2>
        <form action={createSchedule} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <select name="route_id" required className="rounded-xl border border-slate-200 bg-slate-50 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 px-3 py-2 text-sm">
            {routes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <select name="direction" required className="rounded-xl border border-slate-200 bg-slate-50 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 px-3 py-2 text-sm">
            <option value="outbound">Ida</option>
            <option value="return">Vuelta</option>
          </select>
          <input
            name="depart_time"
            placeholder="Hora (HH:MM)"
            inputMode="numeric"
            required
            className="rounded-xl border border-slate-200 bg-slate-50 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-xl bg-blue-600 px-4 py-2.5 font-display text-sm font-bold text-white shadow-md shadow-blue-600/20 hover:bg-blue-700"
          >
            Agregar
          </button>
        </form>
      </section>

      {routes.map((route) =>
        (["outbound", "return"] as const).map((dir) => {
          const list = schedules.filter((s) => s.route_id === route.id && s.direction === dir);
          return (
            <section key={`${route.id}-${dir}`} className="rounded-2xl border border-slate-200 bg-white shadow-xs p-4 sm:p-5">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">{directionLabel(route, dir)}</h2>
              {list.length === 0 ? (
                <p className="text-sm text-slate-400">Sin horarios. Los viajes quedarán sin horario asignado.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {list.map((s) => (
                    <form
                      key={s.id}
                      action={deleteSchedule}
                      className="flex items-center gap-2 rounded-full border border-slate-300 px-3 py-1.5 text-sm"
                    >
                      <input type="hidden" name="id" value={s.id} />
                      <span className="text-slate-900">{s.depart_time.slice(0, 5)}</span>
                      <button type="submit" aria-label="Eliminar horario" className="text-red-600">
                        ×
                      </button>
                    </form>
                  ))}
                </div>
              )}
            </section>
          );
        }),
      )}
    </div>
  );
}
