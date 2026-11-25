import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { supabase } from "../lib/supabase";
import {
  getLocalTrips,
  getReference,
  isToday,
  pruneLocalTrips,
  refreshReference,
  syncPending,
} from "../lib/offline";
import { SyncBanner } from "../components/SyncBanner";
import { isTripOverdue, TRIP_OPEN_ALERT_MINUTES } from "@trans-chavez/shared";
import type { Bus, Profile, Route, Ticket, Trip } from "@trans-chavez/shared";

interface TripRow {
  trip: Trip;
  route?: Route;
  bus?: Bus;
  ticketCount: number;
  passengers: number;
  total: number;
}

const STATUS_LABEL: Record<Trip["status"], string> = {
  in_progress: "En curso",
  completed: "Finalizado",
};

export function HomeScreen({
  profile,
  onOpenTrip,
  onViewTrip,
  onStartTrip,
  onLogout,
}: {
  profile: Profile;
  /** Retoma el cobro de un viaje en curso. */
  onOpenTrip: (trip: Trip, route: Route) => void;
  /** Ver el detalle de boletos de un viaje finalizado. */
  onViewTrip: (trip: Trip, route: Route) => void;
  /** Abre el formulario de inicio de viaje. */
  onStartTrip: () => void;
  onLogout: () => void;
}) {
  const [rows, setRows] = useState<TripRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    await pruneLocalTrips(profile.id);
    void syncPending(profile.id);

    const ref = (await getReference()) ?? (await refreshReference());
    const routeById = new Map((ref?.routes ?? []).map((r) => [r.id, r]));
    const busById = new Map((ref?.buses ?? []).map((b) => [b.id, b]));

    // Viajes guardados en este teléfono (incluye los aún sin sincronizar)
    const local = await getLocalTrips(profile.id);
    const localIds = new Set(local.map((lt) => lt.trip.id));
    const result: TripRow[] = local.map((lt) => ({
      trip: lt.trip,
      route: routeById.get(lt.trip.route_id),
      bus: busById.get(lt.trip.bus_id),
      ticketCount: lt.tickets.length,
      passengers: lt.tickets.reduce((n, t) => n + t.passenger_count, 0),
      total: lt.tickets.reduce((n, t) => n + t.fare_amount * t.passenger_count, 0),
    }));

    // Viajes del servidor que no están en el teléfono (ej. se iniciaron en otro dispositivo)
    try {
      const { data: trips, error } = await supabase
        .from("trips")
        .select("*")
        .eq("cobrador_id", profile.id)
        .order("departure_at", { ascending: false })
        .limit(40);
      const remote = ((!error && (trips as Trip[])) || []).filter(
        (t) => !localIds.has(t.id) && (t.status === "in_progress" || isToday(t.departure_at)),
      );
      if (remote.length > 0) {
        const { data: tickets } = await supabase
          .from("tickets")
          .select("trip_id, passenger_count, fare_amount")
          .in("trip_id", remote.map((t) => t.id));
        const counts = new Map<string, { n: number; pax: number; total: number }>();
        for (const t of (tickets as Pick<Ticket, "trip_id" | "passenger_count" | "fare_amount">[]) ?? []) {
          const c = counts.get(t.trip_id) ?? { n: 0, pax: 0, total: 0 };
          c.n += 1;
          c.pax += t.passenger_count;
          c.total += t.fare_amount * t.passenger_count;
          counts.set(t.trip_id, c);
        }
        for (const trip of remote) {
          result.push({
            trip,
            route: routeById.get(trip.route_id),
            bus: busById.get(trip.bus_id),
            ticketCount: counts.get(trip.id)?.n ?? 0,
            passengers: counts.get(trip.id)?.pax ?? 0,
            total: counts.get(trip.id)?.total ?? 0,
          });
        }
      }
    } catch {
      // Sin señal: se muestran solo los viajes guardados en el teléfono
    }

    // Solo los viajes de hoy y los que siguen en curso; cada día empieza en cero
    setRows(
      result
        .filter((r) => r.trip.status === "in_progress" || isToday(r.trip.departure_at))
        .sort((x, y) => y.trip.departure_at.localeCompare(x.trip.departure_at)),
    );
    setLoading(false);
  }, [profile.id]);

  const hasInProgress = rows.some((r) => r.trip.status === "in_progress");
  const finished = rows.filter((r) => r.trip.status !== "in_progress").length;
  const day = rows.reduce(
    (a, r) => ({
      tickets: a.tickets + r.ticketCount,
      passengers: a.passengers + r.passengers,
      total: a.total + r.total,
    }),
    { tickets: 0, passengers: 0, total: 0 },
  );

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Hola, {profile.full_name}</Text>
          <Text style={styles.subtitle}>Tus viajes de hoy</Text>
        </View>
        <Pressable onPress={onLogout}>
          <Text style={styles.logout}>Salir</Text>
        </Pressable>
      </View>

      <SyncBanner userId={profile.id} />

      {!loading && (
        <View style={styles.dayCard}>
          <View style={styles.dayTop}>
            <View>
              <Text style={styles.dayLabel}>TOTAL DEL DÍA</Text>
              <Text style={styles.dayTotal}>L {day.total.toFixed(2)}</Text>
            </View>
            <Text style={styles.dayPill}>
              {finished} {finished === 1 ? "finalizado" : "finalizados"}
              {hasInProgress ? " · 1 en curso" : ""}
            </Text>
          </View>
          <View style={styles.dayStats}>
            {[
              ["Viajes", rows.length],
              ["Boletos", day.tickets],
              ["Pasajeros", day.passengers],
            ].map(([label, value]) => (
              <View key={label} style={styles.dayStat}>
                <Text style={styles.dayStatLabel}>{label}</Text>
                <Text style={styles.dayStatValue}>{value}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {hasInProgress ? (
        <Text style={styles.notice}>
          Tienes un viaje en curso. Ábrelo para seguir cobrando o finalizarlo.
        </Text>
      ) : (
        <Pressable style={styles.startButton} onPress={() => onStartTrip()}>
          <Text style={styles.startButtonText}>Iniciar viaje</Text>
        </Pressable>
      )}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row) => row.trip.id}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={load} />
          }
          contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
          ListEmptyComponent={
            <Text style={styles.empty}>Hoy no tienes viajes. Toca "Iniciar viaje".</Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => {
                if (!item.route) return;
                if (item.trip.status === "in_progress") onOpenTrip(item.trip, item.route);
                else onViewTrip(item.trip, item.route);
              }}
              disabled={!item.route}
            >
              <Text style={styles.cardTitle}>{item.route?.name ?? "—"}</Text>
              <Text style={styles.cardSubtitle}>
                Bus {item.bus?.plate ?? "—"} ·{" "}
                {new Date(item.trip.departure_at).toLocaleString("es-HN", {
                  hour: "2-digit",
                  minute: "2-digit",
                  day: "2-digit",
                  month: "short",
                })}
              </Text>
              <View style={styles.cardFooter}>
                <Text style={[styles.cardStatus, item.trip.status === "in_progress" ? styles.statusActive : styles.statusDone]}>
                  {STATUS_LABEL[item.trip.status]}
                  {item.trip.status === "completed" ? " · ver boletos" : ""}
                  {isTripOverdue(item.trip) ? ` · más de ${TRIP_OPEN_ALERT_MINUTES} min abierto` : ""}
                </Text>
                <Text style={styles.cardStats}>
                  {item.ticketCount} {item.ticketCount === 1 ? "boleto" : "boletos"} · L {item.total.toFixed(2)}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f8f7", padding: 20 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  title: { fontSize: 18, fontWeight: "600", color: "#0e2a47" },
  subtitle: { fontSize: 13, color: "#5b6b7b", marginTop: 2 },
  logout: { fontSize: 13, color: "#5b6b7b" },
  dayCard: {
    backgroundColor: "#0f8a7d",
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
  },
  dayTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  dayLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1, color: "rgba(255,255,255,0.8)" },
  dayTotal: { fontSize: 30, fontWeight: "800", color: "#fff", marginTop: 2 },
  dayPill: {
    fontSize: 11,
    fontWeight: "600",
    color: "#fff",
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  dayStats: { flexDirection: "row", gap: 8, marginTop: 12 },
  dayStat: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.15)",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dayStatLabel: { fontSize: 11, fontWeight: "600", color: "rgba(255,255,255,0.8)" },
  dayStatValue: { fontSize: 20, fontWeight: "800", color: "#fff" },
  notice: { fontSize: 13, color: "#b45309", marginBottom: 12 },
  startButton: {
    backgroundColor: "#0f8a7d",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  startButtonText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  empty: { textAlign: "center", color: "#8a9bab", marginTop: 40 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#dce7e4",
  },
  cardTitle: { fontSize: 16, fontWeight: "600", color: "#0e2a47" },
  cardSubtitle: { fontSize: 13, color: "#5b6b7b", marginTop: 2 },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
  cardStatus: {
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: "hidden",
  },
  statusActive: { backgroundColor: "#ecfdf5", color: "#059669" },
  statusDone: { backgroundColor: "#eef4f2", color: "#475569" },
  cardStats: { fontSize: 12, color: "#475569" },
});
