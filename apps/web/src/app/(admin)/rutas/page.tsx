import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createRoute, createStop, saveStopPrices } from "@/lib/actions/routes";
import { calculateSegmentPrice, orderStopsForDirection } from "@trans-chavez/shared";
import type { Route, Stop, StopPrice } from "@trans-chavez/shared";

export default async function RutasPage() {
  const supabase = await createSupabaseServerClient();

  const [routesRes, stopsRes, pricesRes] = await Promise.all([
    supabase.from("routes").select("*").order("created_at"),
    supabase.from("stops").select("*").order("sequence"),
    supabase.from("stop_prices").select("*"),
  ]);

  const routes = (routesRes.data as Route[]) ?? [];
  const stops = (stopsRes.data as Stop[]) ?? [];
  const stopPrices = (pricesRes.data as StopPrice[]) ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">
          Rutas y paradas
        </h1>
        <p className="text-sm text-slate-500">
          Define las rutas, sus paradas en orden, y la tarifa de cada tramo.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-medium text-slate-700">
          Nueva ruta
        </h2>
        <form action={createRoute} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input
            name="name"
            placeholder="Nombre de la ruta"
            required
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            name="origin"
            placeholder="Origen"
            required
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            name="destination"
            placeholder="Destino"
            required
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="col-span-1 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 sm:col-span-3 sm:w-fit"
          >
            Crear ruta
          </button>
        </form>
      </section>

      {routes.map((route) => {
        const routeStops = stops
          .filter((s) => s.route_id === route.id)
          .sort((a, b) => a.sequence - b.sequence);
        const routePrices = stopPrices.filter((p) =>
          routeStops.some((s) => s.id === p.stop_id),
        );
        const priceOf = (stopId: string, direction: "outbound" | "return") =>
          routePrices.find((p) => p.stop_id === stopId && p.direction === direction)
            ?.price_to_end;
        // Vista previa: precio desde la primera parada hasta cada una, en cada sentido
        const preview = (direction: "outbound" | "return") => {
          const ordered = orderStopsForDirection(routeStops, direction);
          return ordered.slice(1).map((stop) => {
            try {
              return {
                stop,
                price: calculateSegmentPrice(ordered, routePrices, direction, ordered[0].id, stop.id),
              };
            } catch {
              return { stop, price: null };
            }
          });
        };

        return (
          <section
            key={route.id}
            className="rounded-xl border border-slate-200 bg-white p-5"
          >
            <h2 className="text-sm font-medium text-slate-900">
              {route.name}
            </h2>

            <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <h3 className="mb-2 text-xs font-medium uppercase text-slate-500">
                  Paradas
                </h3>
                <ol className="mb-3 space-y-1 text-sm text-slate-700">
                  {routeStops.map((s) => (
                    <li key={s.id}>
                      {s.sequence}. {s.name}
                    </li>
                  ))}
                  {routeStops.length === 0 && (
                    <li className="text-slate-400">Sin paradas aún.</li>
                  )}
                </ol>
                <form
                  action={createStop}
                  className="flex flex-wrap gap-2"
                >
                  <input type="hidden" name="route_id" value={route.id} />
                  <input
                    name="name"
                    placeholder="Nombre de la parada"
                    required
                    className="min-w-[10rem] flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  />
                  <input
                    name="sequence"
                    type="number"
                    min={1}
                    placeholder="#"
                    required
                    className="w-16 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  />
                  <button
                    type="submit"
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Agregar
                  </button>
                </form>
              </div>

              <div>
                <h3 className="mb-1 text-xs font-medium uppercase text-slate-500">
                  Precio hasta el final del recorrido
                </h3>
                <p className="mb-3 text-xs text-slate-400">
                  Cuánto cuesta ir desde cada parada hasta el final, en cada
                  sentido. El tramo se cobra por diferencia (la última parada
                  de cada sentido va en 0).
                </p>
                {routeStops.length >= 2 ? (
                  <form action={saveStopPrices} className="space-y-2">
                    <div className="grid grid-cols-[1fr_5rem_5rem] items-center gap-2 text-xs text-slate-500">
                      <span>Parada</span>
                      <span>Ida (L)</span>
                      <span>Vuelta (L)</span>
                    </div>
                    {routeStops.map((s) => (
                      <div
                        key={s.id}
                        className="grid grid-cols-[1fr_5rem_5rem] items-center gap-2 text-sm text-slate-700"
                      >
                        <span>{s.sequence}. {s.name}</span>
                        {(["outbound", "return"] as const).map((dir) => (
                          <input
                            key={dir}
                            name={`price__${s.id}__${dir}`}
                            type="number"
                            step="0.01"
                            min={0}
                            defaultValue={priceOf(s.id, dir)}
                            placeholder="—"
                            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                          />
                        ))}
                      </div>
                    ))}
                    <button
                      type="submit"
                      className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
                    >
                      Guardar precios
                    </button>
                  </form>
                ) : (
                  <p className="text-sm text-slate-400">
                    Agrega al menos 2 paradas para definir precios.
                  </p>
                )}
                {routeStops.length >= 2 && (
                  <div className="mt-4 grid grid-cols-2 gap-4 text-xs text-slate-600">
                    {(["outbound", "return"] as const).map((dir) => {
                      const ordered = orderStopsForDirection(routeStops, dir);
                      return (
                        <div key={dir}>
                          <p className="mb-1 font-medium text-slate-500">
                            {dir === "outbound" ? "Ida" : "Vuelta"}: desde {ordered[0].name}
                          </p>
                          <ul className="space-y-0.5">
                            {preview(dir).map(({ stop, price }) => (
                              <li key={stop.id}>
                                {stop.name}:{" "}
                                {price === null ? (
                                  <span className="text-amber-600">revisar precios</span>
                                ) : (
                                  `L ${price.toFixed(2)}`
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
