import { hondurasDay } from "./ticketNumber";

/** Margen máximo (minutos) entre la hora real y el horario para asignar el viaje a ese horario. */
export const SCHEDULE_TOLERANCE_MINUTES = 45;

/**
 * Horario de la ruta más cercano a `now` (dentro de la tolerancia), como fecha ISO.
 * `times` son horas de Honduras "HH:MM" o "HH:MM:SS". Devuelve null si ninguno queda cerca.
 */
export function nearestSchedule(
  now: Date,
  times: string[],
  toleranceMinutes: number = SCHEDULE_TOLERANCE_MINUTES,
): string | null {
  const day = hondurasDay(now);
  let best: { at: Date; diff: number } | null = null;
  for (const t of times) {
    const m = /^(\d{1,2}):(\d{2})/.exec(t);
    if (!m) continue;
    const at = new Date(`${day}T${m[1].padStart(2, "0")}:${m[2]}:00-06:00`);
    const diff = Math.abs(at.getTime() - now.getTime());
    if (!best || diff < best.diff) best = { at, diff };
  }
  return best && best.diff <= toleranceMinutes * 60_000 ? best.at.toISOString() : null;
}
