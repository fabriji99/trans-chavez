"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../supabase/server";
import { requireCobrador } from "../dal";
import {
  calculateSegmentPrice,
  calculateTicketTotal,
  directionLabel,
  formatTicketNumber,
  hondurasDay,
  orderStopsForDirection,
  ticketPrefix,
  ticketSeq,
} from "@trans-chavez/shared";
import type { ReceiptData, Route, Stop, StopPrice, Trip } from "@trans-chavez/shared";

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/** Datos del viaje tal como los espera la función sync_trip de la base de datos. */
function tripPayload(trip: Trip, overrides: Partial<Trip> = {}) {
  const t = { ...trip, ...overrides };
  return {
    id: t.id,
    route_id: t.route_id,
    bus_id: t.bus_id,
    driver_id: t.driver_id,
    direction: t.direction,
    departure_at: t.departure_at,
    started_at: t.started_at,
    ended_at: t.ended_at,
    status: t.status,
  };
}

async function getOwnTrip(supabase: Supabase, tripId: string, userId: string): Promise<Trip> {
  const { data } = await supabase.from("trips").select("*").eq("id", tripId).single();
  const trip = data as Trip | null;
  if (!trip || trip.cobrador_id !== userId) throw new Error("No se encontró el viaje.");
  return trip;
}

/** Hora HH:MM de hoy (hora de Honduras) como fecha ISO. */
function todayAtHonduras(hhmm: string): string | null {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(hhmm.trim());
  if (!match) return null;
  const hh = match[1].padStart(2, "0");
  return new Date(`${hondurasDay(new Date())}T${hh}:${match[2]}:00-06:00`).toISOString();
}

export async function startTrip(formData: FormData) {
  const profile = await requireCobrador();
  const supabase = await createSupabaseServerClient();

  const routeId = String(formData.get("route_id") ?? "");
  const direction = String(formData.get("direction") ?? "");
  const busId = String(formData.get("bus_id") ?? "");
  const driverId = String(formData.get("driver_id") ?? "");
  const departure = todayAtHonduras(String(formData.get("time") ?? ""));

  if (!routeId) throw new Error("Elige la ruta del viaje.");
  if (direction !== "outbound" && direction !== "return") throw new Error("Elige el sentido del viaje.");
  if (!busId) throw new Error("Elige el bus del viaje.");
  if (!driverId) throw new Error("Elige el chofer del viaje.");
  if (!departure) throw new Error("Escribe la hora con el formato HH:MM, por ejemplo 06:30.");

  // Un cobrador solo puede tener un viaje en curso a la vez
  const { data: open } = await supabase
    .from("trips")
    .select("id")
    .eq("cobrador_id", profile.id)
    .eq("status", "in_progress")
    .limit(1);
  if (open && open.length > 0) {
    redirect(`/cobrador/viaje/${open[0].id}`);
  }

  const id = randomUUID();
  const { error } = await supabase.rpc("sync_trip", {
    p_trip: {
      id,
      route_id: routeId,
      bus_id: busId,
      driver_id: driverId,
      direction,
      departure_at: departure,
      started_at: new Date().toISOString(),
      ended_at: null,
      status: "in_progress",
    },
    p_tickets: [],
  });
  if (error) throw new Error(error.message);

  revalidatePath("/cobrador");
  redirect(`/cobrador/viaje/${id}`);
}

export interface CreateTicketResult {
  error?: string;
  receipt?: ReceiptData;
}

export async function createTicket(input: {
  tripId: string;
  boardingId: string;
  alightingId: string;
  passengers: number;
}): Promise<CreateTicketResult> {
  const profile = await requireCobrador();
  const supabase = await createSupabaseServerClient();

  try {
    if (!profile.code) {
      return { error: "Tu cuenta aún no tiene código de cobrador. Avisa al administrador." };
    }
    const passengers = Math.floor(Number(input.passengers));
    if (!Number.isFinite(passengers) || passengers < 1 || passengers > 99) {
      return { error: "La cantidad de pasajeros no es válida." };
    }

    const trip = await getOwnTrip(supabase, input.tripId, profile.id);
    if (trip.status !== "in_progress") {
      return { error: "Este viaje ya está finalizado." };
    }

    const [{ data: routeData }, { data: stopData }] = await Promise.all([
      supabase.from("routes").select("*").eq("id", trip.route_id).single(),
      supabase.from("stops").select("*").eq("route_id", trip.route_id).eq("active", true),
    ]);
    const route = routeData as Route | null;
    const stops = (stopData as Stop[] | null) ?? [];
    if (!route) return { error: "No se encontró la ruta del viaje." };

    const { data: priceData } = await supabase
      .from("stop_prices")
      .select("*")
      .in("stop_id", stops.map((s) => s.id));
    const stopPrices = (priceData as StopPrice[] | null) ?? [];

    // El precio se calcula aquí con los datos de la base, no se confía en el del teléfono
    const ordered = orderStopsForDirection(stops, trip.direction);
    const fare = calculateSegmentPrice(
      ordered,
      stopPrices,
      trip.direction,
      input.boardingId,
      input.alightingId,
    );
    const total = calculateTicketTotal(fare, passengers);

    const createdAt = new Date();
    const day = hondurasDay(createdAt);
    const prefix = ticketPrefix(profile.code, day);

    // Siguiente número del día; si dos boletos coinciden, se reintenta con el siguiente
    for (let attempt = 0; attempt < 4; attempt++) {
      const { data: last } = await supabase
        .from("tickets")
        .select("ticket_number")
        .like("ticket_number", `${prefix}-%`)
        .order("ticket_number", { ascending: false })
        .limit(1);
      const lastSeq = last?.[0]?.ticket_number ? ticketSeq(last[0].ticket_number as string, prefix) : null;
      const ticketNumber = formatTicketNumber(profile.code, day, (lastSeq ?? 0) + 1);

      const { error } = await supabase.rpc("sync_trip", {
        p_trip: tripPayload(trip),
        p_tickets: [
          {
            id: randomUUID(),
            boarding_stop_id: input.boardingId,
            alighting_stop_id: input.alightingId,
            passenger_count: passengers,
            fare_amount: fare,
            payment_method: "cash",
            created_at: createdAt.toISOString(),
            ticket_number: ticketNumber,
          },
        ],
      });

      if (error) {
        if (/duplicate|unique/i.test(error.message) && attempt < 3) continue;
        return { error: error.message };
      }

      revalidatePath(`/cobrador/viaje/${trip.id}`);
      revalidatePath("/cobrador");
      return {
        receipt: {
          company: "Trans. Chávez",
          ticketNumber,
          createdAt: createdAt.toISOString(),
          routeLabel: directionLabel(route, trip.direction),
          boarding: ordered.find((s) => s.id === input.boardingId)?.name ?? "",
          alighting: ordered.find((s) => s.id === input.alightingId)?.name ?? "",
          passengers,
          unitPrice: fare,
          total,
          collectorCode: profile.code,
        },
      };
    }
    return { error: "No se pudo asignar el número de boleto. Intenta de nuevo." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "No se pudo registrar el boleto." };
  }
}

export async function finishTrip(formData: FormData) {
  const profile = await requireCobrador();
  const supabase = await createSupabaseServerClient();

  const trip = await getOwnTrip(supabase, String(formData.get("trip_id") ?? ""), profile.id);
  if (trip.status === "in_progress") {
    const { error } = await supabase.rpc("sync_trip", {
      p_trip: tripPayload(trip, { status: "completed", ended_at: new Date().toISOString() }),
      p_tickets: [],
    });
    if (error) throw new Error(error.message);
  }

  revalidatePath("/cobrador");
  redirect("/cobrador");
}
