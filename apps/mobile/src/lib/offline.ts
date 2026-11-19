import { useEffect, useState } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";
import {
  formatTicketNumber,
  hondurasDay,
  ticketPrefix,
  ticketSeq,
} from "@trans-chavez/shared";
import type {
  Bus,
  Driver,
  Route,
  Stop,
  StopPrice,
  Ticket,
  Trip,
} from "@trans-chavez/shared";

/** Datos que cambian poco y se guardan para usar la app sin señal. */
export interface Reference {
  routes: Route[];
  buses: Bus[];
  drivers: Driver[];
  stops: Stop[];
  stopPrices: StopPrice[];
}

/** Viaje guardado en el teléfono; `rev` sube con cada cambio y `syncedRev` es lo último enviado. */
export interface LocalTrip {
  trip: Trip;
  tickets: Ticket[];
  rev: number;
  syncedRev: number;
}

const REF_KEY = "ref:v1";
const tripsKey = (uid: string) => `trips:v1:${uid}`;
const SYNC_INTERVAL_MS = 20_000;

// ---------- utilidades ----------

export function newId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 3) | 8).toString(16);
  });
}

export function isToday(iso: string): boolean {
  return hondurasDay(iso) === hondurasDay(new Date());
}

// ---------- estado y suscripciones ----------

const listeners = new Set<() => void>();
let lastSyncError: string | null = null;
const emit = () => listeners.forEach((fn) => fn());
export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

// ---------- datos de referencia ----------

let refCache: Reference | null = null;

export async function getReference(): Promise<Reference | null> {
  if (refCache) return refCache;
  try {
    const raw = await AsyncStorage.getItem(REF_KEY);
    refCache = raw ? (JSON.parse(raw) as Reference) : null;
  } catch {
    refCache = null;
  }
  return refCache;
}

/** Descarga los datos de referencia; devuelve null si no hay señal. */
export async function refreshReference(): Promise<Reference | null> {
  try {
    const [routes, buses, drivers, stops, stopPrices] = await Promise.all([
      supabase.from("routes").select("*").eq("active", true).order("name"),
      supabase.from("buses").select("*").eq("active", true).order("plate"),
      supabase.from("drivers").select("*").eq("active", true).order("full_name"),
      supabase.from("stops").select("*").eq("active", true).order("sequence"),
      supabase.from("stop_prices").select("*"),
    ]);
    if (routes.error || buses.error || drivers.error || stops.error || stopPrices.error) {
      return null;
    }
    refCache = {
      routes: (routes.data as Route[]) ?? [],
      buses: (buses.data as Bus[]) ?? [],
      drivers: (drivers.data as Driver[]) ?? [],
      stops: (stops.data as Stop[]) ?? [],
      stopPrices: (stopPrices.data as StopPrice[]) ?? [],
    };
    await AsyncStorage.setItem(REF_KEY, JSON.stringify(refCache));
    return refCache;
  } catch {
    return null;
  }
}

/** Usa lo guardado y, si no hay nada todavía, intenta descargarlo. */
export async function loadReference(): Promise<Reference | null> {
  const cached = await getReference();
  if (cached) {
    void refreshReference();
    return cached;
  }
  return refreshReference();
}

// ---------- viajes locales ----------

const tripsCache = new Map<string, LocalTrip[]>();

async function readTrips(uid: string): Promise<LocalTrip[]> {
  const cached = tripsCache.get(uid);
  if (cached) return cached;
  let list: LocalTrip[] = [];
  try {
    const raw = await AsyncStorage.getItem(tripsKey(uid));
    list = raw ? (JSON.parse(raw) as LocalTrip[]) : [];
  } catch {
    list = [];
  }
  // Si otra llamada llenó la caché mientras leíamos, se respeta esa
  return tripsCache.get(uid) ?? (tripsCache.set(uid, list), list);
}

/** Aplica un cambio de forma atómica (sin awaits entre leer y reemplazar la lista) y lo guarda. */
async function mutate(uid: string, fn: (list: LocalTrip[]) => LocalTrip[]): Promise<void> {
  const current = await readTrips(uid);
  const next = fn(current);
  tripsCache.set(uid, next);
  emit();
  await AsyncStorage.setItem(tripsKey(uid), JSON.stringify(next));
}

export async function getLocalTrips(uid: string): Promise<LocalTrip[]> {
  return [...(await readTrips(uid))];
}

export async function getLocalTrip(uid: string, tripId: string): Promise<LocalTrip | undefined> {
  return (await readTrips(uid)).find((t) => t.trip.id === tripId);
}

export async function startLocalTrip(
  uid: string,
  fields: Pick<Trip, "route_id" | "direction" | "bus_id" | "driver_id" | "departure_at">,
): Promise<Trip> {
  // Un cobrador solo puede tener un viaje en curso a la vez
  if ((await readTrips(uid)).some((lt) => lt.trip.status === "in_progress")) {
    throw new Error("Ya tienes un viaje en curso. Finalízalo antes de iniciar otro.");
  }
  const now = new Date().toISOString();
  const trip: Trip = {
    id: newId(),
    ...fields,
    cobrador_id: uid,
    scheduled_at: null,
    started_at: now,
    ended_at: null,
    synced_at: null,
    status: "in_progress",
    created_at: now,
  };
  await mutate(uid, (list) => [...list, { trip, tickets: [], rev: 1, syncedRev: 0 }]);
  void syncPending(uid);
  return trip;
}

/** Si el viaje vino del servidor (no se inició en este teléfono), se adopta como ya sincronizado. */
function withTrip(list: LocalTrip[], trip: Trip): LocalTrip[] {
  return list.some((lt) => lt.trip.id === trip.id)
    ? list
    : [...list, { trip, tickets: [], rev: 1, syncedRev: 1 }];
}

// ---------- número de boleto ----------

const seqKey = (uid: string, day: string) => `seq:v1:${uid}:${day}`;
let seqQueue: Promise<unknown> = Promise.resolve();

/** Ejecuta las operaciones del contador una a una para que nunca se repita un número. */
function withSeqLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = seqQueue.then(fn);
  seqQueue = run.catch(() => undefined);
  return run;
}

/** Mayor consecutivo ya usado hoy por este cobrador (contador guardado y boletos locales). */
async function lastSeqToday(uid: string, code: string, day: string): Promise<number> {
  const raw = await AsyncStorage.getItem(seqKey(uid, day));
  let last = raw ? Number(raw) || 0 : 0;
  const prefix = ticketPrefix(code, day);
  for (const lt of await readTrips(uid)) {
    for (const t of lt.tickets) {
      const n = t.ticket_number ? ticketSeq(t.ticket_number, prefix) : null;
      if (n && n > last) last = n;
    }
  }
  return last;
}

/** Siguiente número de boleto, ej. C01-061026-0007. Funciona sin señal. */
export function nextTicketNumber(uid: string, code: string): Promise<string> {
  return withSeqLock(async () => {
    const day = hondurasDay(new Date());
    const seq = (await lastSeqToday(uid, code, day)) + 1;
    await AsyncStorage.setItem(seqKey(uid, day), String(seq));
    return formatTicketNumber(code, day, seq);
  });
}

/** Con señal, avisa al contador local el último número que ya recibió el servidor hoy. */
export async function restoreSeqFromServer(uid: string, code: string): Promise<void> {
  try {
    const day = hondurasDay(new Date());
    const prefix = ticketPrefix(code, day);
    const { data, error } = await supabase
      .from("tickets")
      .select("ticket_number")
      .like("ticket_number", `${prefix}-%`)
      .order("ticket_number", { ascending: false })
      .limit(1);
    if (error || !data?.[0]?.ticket_number) return;
    const serverSeq = ticketSeq(data[0].ticket_number as string, prefix);
    if (!serverSeq) return;
    await withSeqLock(async () => {
      const last = await lastSeqToday(uid, code, day);
      if (serverSeq > last) await AsyncStorage.setItem(seqKey(uid, day), String(serverSeq));
    });
  } catch {
    // Sin señal: se usa el contador local
  }
}

export async function addLocalTicket(
  uid: string,
  code: string | null,
  trip: Trip,
  input: Omit<Ticket, "id" | "created_at" | "synced_at" | "ticket_number">,
): Promise<Ticket> {
  if (!code) {
    throw new Error(
      "Tu cuenta aún no tiene código de cobrador. Abre la app con internet o avisa al administrador.",
    );
  }
  const ticket: Ticket = {
    ...input,
    id: newId(),
    ticket_number: await nextTicketNumber(uid, code),
    created_at: new Date().toISOString(),
    synced_at: null,
  };
  await mutate(uid, (list) =>
    withTrip(list, trip).map((lt) =>
      lt.trip.id === trip.id
        ? { ...lt, tickets: [...lt.tickets, ticket], rev: lt.rev + 1 }
        : lt,
    ),
  );
  void syncPending(uid);
  return ticket;
}

export async function finishLocalTrip(uid: string, trip: Trip): Promise<void> {
  await mutate(uid, (list) =>
    withTrip(list, trip).map((lt) =>
      lt.trip.id === trip.id
        ? {
            ...lt,
            trip: { ...lt.trip, status: "completed", ended_at: new Date().toISOString() },
            rev: lt.rev + 1,
          }
        : lt,
    ),
  );
  void syncPending(uid);
}

/** Quita los viajes ya sincronizados que no son de hoy ni están en curso. */
export async function pruneLocalTrips(uid: string): Promise<void> {
  const list = await readTrips(uid);
  const keep = list.filter(
    (lt) =>
      lt.rev > lt.syncedRev || lt.trip.status === "in_progress" || isToday(lt.trip.departure_at),
  );
  if (keep.length !== list.length) await mutate(uid, () => keep);
}

// ---------- sincronización ----------

let syncing = false;

export async function syncPending(uid: string): Promise<void> {
  if (syncing) return;
  syncing = true;
  try {
    const dirty = (await readTrips(uid)).filter((lt) => lt.rev > lt.syncedRev);
    for (const lt of dirty) {
      const { trip, tickets, rev } = lt;
      const { error } = await supabase.rpc("sync_trip", {
        p_trip: {
          id: trip.id,
          route_id: trip.route_id,
          bus_id: trip.bus_id,
          driver_id: trip.driver_id,
          direction: trip.direction,
          departure_at: trip.departure_at,
          started_at: trip.started_at,
          ended_at: trip.ended_at,
          status: trip.status,
        },
        p_tickets: tickets.map((t) => ({
          id: t.id,
          boarding_stop_id: t.boarding_stop_id,
          alighting_stop_id: t.alighting_stop_id,
          passenger_count: t.passenger_count,
          fare_amount: t.fare_amount,
          payment_method: t.payment_method,
          created_at: t.created_at,
          ticket_number: t.ticket_number,
        })),
      });
      if (error) {
        lastSyncError = error.message;
        emit();
        // Sin señal o sesión vencida: se reintenta luego; no seguimos con los demás
        break;
      }
      lastSyncError = null;
      await mutate(uid, (list) =>
        list.map((x) => (x.trip.id === trip.id ? { ...x, syncedRev: Math.max(x.syncedRev, rev) } : x)),
      );
    }
  } finally {
    syncing = false;
  }
}

/** Reintenta enviar lo pendiente cada cierto tiempo y al volver a abrir la app. */
export function startAutoSync(uid: string, code?: string | null): () => void {
  void syncPending(uid);
  if (code) void restoreSeqFromServer(uid, code);
  const timer = setInterval(() => void syncPending(uid), SYNC_INTERVAL_MS);
  const sub = AppState.addEventListener("change", (state) => {
    if (state === "active") void syncPending(uid);
  });
  return () => {
    clearInterval(timer);
    sub.remove();
  };
}

export interface PendingSync {
  /** Viajes con cambios sin enviar. */
  trips: number;
  error: string | null;
}

export function usePendingSync(uid: string): PendingSync {
  const [state, setState] = useState<PendingSync>({ trips: 0, error: null });
  useEffect(() => {
    let alive = true;
    const update = async () => {
      const list = await readTrips(uid);
      if (!alive) return;
      setState({ trips: list.filter((lt) => lt.rev > lt.syncedRev).length, error: lastSyncError });
    };
    void update();
    const unsubscribe = subscribe(() => void update());
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [uid]);
  return state;
}
