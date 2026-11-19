import type { Route, Stop, StopPrice, TripDirection } from "./types";

export class FareLookupError extends Error {}

export const DIRECTION_LABEL: Record<TripDirection, string> = {
  outbound: "Ida",
  return: "Vuelta",
};

/** Etiqueta del sentido con los extremos de la ruta, ej. "Arada → Santa Bárbara". */
export function directionLabel(
  route: Pick<Route, "origin" | "destination">,
  direction: TripDirection,
): string {
  return direction === "outbound"
    ? `${route.origin} → ${route.destination}`
    : `${route.destination} → ${route.origin}`;
}

/** Paradas en el orden de recorrido del viaje (la vuelta invierte la secuencia). */
export function orderStopsForDirection(
  stops: Stop[],
  direction: TripDirection,
): Stop[] {
  const sorted = [...stops].sort((a, b) => a.sequence - b.sequence);
  return direction === "outbound" ? sorted : sorted.reverse();
}

/** Paradas donde se puede bajar si se sube en `boardingStopId` (solo las siguientes). */
export function stopsAfter(orderedStops: Stop[], boardingStopId: string): Stop[] {
  const index = orderedStops.findIndex((s) => s.id === boardingStopId);
  return index === -1 ? [] : orderedStops.slice(index + 1);
}

/**
 * Precio del tramo = precio_hasta_final(subida) - precio_hasta_final(bajada).
 * `orderedStops` debe venir ordenado según el sentido del viaje.
 */
export function calculateSegmentPrice(
  orderedStops: Stop[],
  stopPrices: StopPrice[],
  direction: TripDirection,
  boardingStopId: string,
  alightingStopId: string,
): number {
  const boardingIdx = orderedStops.findIndex((s) => s.id === boardingStopId);
  const alightingIdx = orderedStops.findIndex((s) => s.id === alightingStopId);
  if (boardingIdx === -1 || alightingIdx === -1) {
    throw new FareLookupError("Parada de subida o bajada inválida.");
  }
  if (boardingIdx >= alightingIdx) {
    throw new FareLookupError(
      "La parada de bajada debe estar después de la parada de subida.",
    );
  }

  const priceOf = (stopId: string) =>
    stopPrices.find((p) => p.stop_id === stopId && p.direction === direction)
      ?.price_to_end;
  const from = priceOf(boardingStopId);
  const to = priceOf(alightingStopId);
  if (from === undefined || to === undefined) {
    throw new FareLookupError(
      "Falta configurar el precio de una de las paradas para este sentido.",
    );
  }

  const price = Math.round((from - to) * 100) / 100;
  if (price <= 0) {
    throw new FareLookupError("El precio de este tramo no está bien configurado.");
  }
  return price;
}

/** Calcula el total a cobrar dado el precio de tarifa y la cantidad de pasajeros. */
export function calculateTicketTotal(
  farePrice: number,
  passengerCount: number,
): number {
  if (passengerCount <= 0) {
    throw new FareLookupError("La cantidad de pasajeros debe ser mayor a 0.");
  }
  return Math.round(farePrice * passengerCount * 100) / 100;
}
