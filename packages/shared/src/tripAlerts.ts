import type { Trip } from "./types";

/** Minutos que un viaje puede estar en curso antes de marcarse como alerta. */
export const TRIP_OPEN_ALERT_MINUTES = 45;

/** Minutos que lleva abierto un viaje en curso (null si ya está finalizado). */
export function minutesOpen(
  trip: Pick<Trip, "status" | "started_at" | "departure_at">,
  now: Date = new Date(),
): number | null {
  if (trip.status !== "in_progress") return null;
  const start = new Date(trip.started_at ?? trip.departure_at).getTime();
  return Math.max(0, Math.floor((now.getTime() - start) / 60_000));
}

export function isTripOverdue(
  trip: Pick<Trip, "status" | "started_at" | "departure_at">,
  now: Date = new Date(),
): boolean {
  const minutes = minutesOpen(trip, now);
  return minutes !== null && minutes > TRIP_OPEN_ALERT_MINUTES;
}
