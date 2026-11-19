import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/dal";
import { directionLabel } from "@trans-chavez/shared";
import type { Bus, Driver, Profile, Route, Stop, Ticket, Trip } from "@trans-chavez/shared";

const TZ = "America/Tegucigalpa";
const PAGE = 1000;

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("es-HN", { timeZone: TZ, hour12: false }) : "";

function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

type TripWithTickets = Trip & { tickets: Ticket[] };

/** Descarga un CSV (abre en Excel) con todos los viajes y boletos de un mes, o de todo el historial. */
export async function GET(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return new NextResponse("No autorizado", { status: 403 });
  }

  const mes = request.nextUrl.searchParams.get("mes") ?? "";
  const all = mes === "todo";
  const match = /^(\d{4})-(\d{2})$/.exec(mes);
  if (!all && !match) return new NextResponse("Mes inválido", { status: 400 });

  const supabase = await createSupabaseServerClient();

  // Los límites del mes se calculan en hora de Honduras (UTC-6)
  let from = "";
  let to = "";
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const nextYear = month === 12 ? year + 1 : year;
    const nextMonth = month === 12 ? 1 : month + 1;
    from = `${match[1]}-${match[2]}-01T00:00:00-06:00`;
    to = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00-06:00`;
  }

  const trips: TripWithTickets[] = [];
  for (let offset = 0; ; offset += PAGE) {
    let query = supabase
      .from("trips")
      .select("*, tickets(*)")
      .order("departure_at", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (!all) query = query.gte("departure_at", from).lt("departure_at", to);
    const { data, error } = await query;
    if (error) return new NextResponse(error.message, { status: 500 });
    const rows = (data as unknown as TripWithTickets[]) ?? [];
    trips.push(...rows);
    if (rows.length < PAGE) break;
  }

  const [routesRes, busesRes, driversRes, profilesRes, stopsRes] = await Promise.all([
    supabase.from("routes").select("*"),
    supabase.from("buses").select("*"),
    supabase.from("drivers").select("*"),
    supabase.from("profiles").select("*"),
    supabase.from("stops").select("*"),
  ]);
  const routeById = new Map(((routesRes.data as Route[]) ?? []).map((r) => [r.id, r]));
  const busById = new Map(((busesRes.data as Bus[]) ?? []).map((b) => [b.id, b]));
  const driverById = new Map(((driversRes.data as Driver[]) ?? []).map((d) => [d.id, d]));
  const profileById = new Map(((profilesRes.data as Profile[]) ?? []).map((p) => [p.id, p]));
  const stopById = new Map(((stopsRes.data as Stop[]) ?? []).map((s) => [s.id, s]));

  const header = [
    "N. boleto", "Fecha boleto", "Boleto sincronizado", "Ruta y sentido", "Bus", "Chofer",
    "Cobrador", "Salida", "Inicio", "Fin", "Viaje sincronizado", "Estado viaje",
    "Sube en", "Baja en", "Pasajeros", "Precio c/u", "Total", "ID viaje", "ID boleto",
  ];
  const lines = [header.map(csvCell).join(",")];

  for (const trip of trips) {
    const route = routeById.get(trip.route_id);
    const tripCols = [
      route ? directionLabel(route, trip.direction) : "",
      busById.get(trip.bus_id)?.plate ?? "",
      trip.driver_id ? (driverById.get(trip.driver_id)?.full_name ?? "") : "",
      profileById.get(trip.cobrador_id)?.full_name ?? "",
      fmt(trip.departure_at),
      fmt(trip.started_at),
      fmt(trip.ended_at),
      fmt(trip.synced_at),
      trip.status === "in_progress" ? "En curso" : "Finalizado",
    ];
    const tickets = [...(trip.tickets ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
    // Un viaje sin boletos también queda registrado, con las columnas del boleto vacías
    if (tickets.length === 0) {
      lines.push(
        ["", "", "", ...tripCols, "", "", "", "", "", trip.id, ""].map(csvCell).join(","),
      );
    }
    for (const t of tickets) {
      lines.push(
        [
          t.ticket_number ?? "",
          fmt(t.created_at),
          fmt(t.synced_at),
          ...tripCols,
          stopById.get(t.boarding_stop_id)?.name ?? "",
          stopById.get(t.alighting_stop_id)?.name ?? "",
          t.passenger_count,
          t.fare_amount,
          t.fare_amount * t.passenger_count,
          trip.id,
          t.id,
        ]
          .map(csvCell)
          .join(","),
      );
    }
  }

  // BOM para que Excel lea bien los acentos
  const body = "﻿" + lines.join("\r\n") + "\r\n";
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="respaldo-trans-chavez-${all ? "completo" : mes}.csv"`,
    },
  });
}
