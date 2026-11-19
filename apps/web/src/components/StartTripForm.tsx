"use client";

import { useState } from "react";
import { startTrip } from "@/lib/actions/cobrador";
import { Chip } from "./Chip";
import { directionLabel } from "@trans-chavez/shared";
import type { Bus, Driver, Route, TripDirection } from "@trans-chavez/shared";

function nowHondurasHHMM(): string {
  return new Intl.DateTimeFormat("es-HN", {
    timeZone: "America/Tegucigalpa",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

const label = "mb-2 mt-5 text-xs font-semibold uppercase text-slate-500";

export function StartTripForm({
  routes,
  buses,
  drivers,
}: {
  routes: Route[];
  buses: Bus[];
  drivers: Driver[];
}) {
  const [routeId, setRouteId] = useState<string | null>(routes.length === 1 ? routes[0].id : null);
  const [direction, setDirection] = useState<TripDirection | null>(null);
  const [busId, setBusId] = useState<string | null>(null);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [time, setTime] = useState(nowHondurasHHMM);
  const [sending, setSending] = useState(false);

  const route = routes.find((r) => r.id === routeId);
  const ready = Boolean(routeId && direction && busId && driverId && /^\d{1,2}:\d{2}$/.test(time));

  return (
    <form action={startTrip} onSubmit={() => setSending(true)}>
      <input type="hidden" name="route_id" value={routeId ?? ""} />
      <input type="hidden" name="direction" value={direction ?? ""} />
      <input type="hidden" name="bus_id" value={busId ?? ""} />
      <input type="hidden" name="driver_id" value={driverId ?? ""} />

      {routes.length > 1 && (
        <>
          <p className={label}>Ruta</p>
          <div className="flex flex-wrap gap-2">
            {routes.map((r) => (
              <Chip key={r.id} label={r.name} active={routeId === r.id} onClick={() => setRouteId(r.id)} />
            ))}
          </div>
        </>
      )}

      {route && (
        <>
          <p className={label}>Sentido del viaje</p>
          <div className="flex flex-wrap gap-2">
            {(["outbound", "return"] as const).map((dir) => (
              <Chip
                key={dir}
                label={directionLabel(route, dir)}
                active={direction === dir}
                onClick={() => setDirection(dir)}
              />
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">No se puede cambiar después de iniciar el viaje.</p>
        </>
      )}

      <p className={label}>Bus</p>
      <div className="flex flex-wrap gap-2">
        {buses.map((b) => (
          <Chip
            key={b.id}
            label={b.name ? `${b.plate} · ${b.name}` : b.plate}
            active={busId === b.id}
            onClick={() => setBusId(b.id)}
          />
        ))}
        {buses.length === 0 && <p className="text-sm text-slate-400">No hay buses registrados.</p>}
      </div>

      <p className={label}>Chofer</p>
      <div className="flex flex-wrap gap-2">
        {drivers.map((d) => (
          <Chip key={d.id} label={d.full_name} active={driverId === d.id} onClick={() => setDriverId(d.id)} />
        ))}
        {drivers.length === 0 && (
          <p className="text-sm text-slate-400">No hay choferes registrados. Pide al administrador que los agregue.</p>
        )}
      </div>

      <p className={label}>Hora del viaje (HH:MM)</p>
      <input
        name="time"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        inputMode="numeric"
        maxLength={5}
        placeholder="06:30"
        className="w-28 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base"
      />

      <button
        type="submit"
        disabled={!ready || sending}
        className="mt-8 w-full rounded-xl bg-slate-900 py-4 text-base font-semibold text-white disabled:opacity-50"
      >
        {sending ? "Iniciando..." : "Iniciar viaje"}
      </button>
    </form>
  );
}
