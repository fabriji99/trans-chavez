import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { supabase } from "../lib/supabase";
import { getLocalTrip, getReference } from "../lib/offline";
import { formatDateTime, formatTime } from "../lib/format";
import type { Bus, Driver, Route, Stop, Ticket, Trip } from "@trans-chavez/shared";

export function TripDetailScreen({
  trip,
  route,
  userId,
  onBack,
}: {
  trip: Trip;
  route: Route;
  userId: string;
  onBack: () => void;
}) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [stops, setStops] = useState<Stop[]>([]);
  const [bus, setBus] = useState<Bus | null>(null);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const ref = await getReference();
      setStops((ref?.stops ?? []).filter((s) => s.route_id === route.id));
      setBus(ref?.buses.find((b) => b.id === trip.bus_id) ?? null);
      setDriver(ref?.drivers.find((d) => d.id === trip.driver_id) ?? null);

      // Un viaje guardado en el teléfono tiene sus boletos locales; si no, se piden al servidor
      const local = await getLocalTrip(userId, trip.id);
      if (local) {
        setTickets([...local.tickets].reverse());
      } else {
        const { data } = await supabase
          .from("tickets")
          .select("*")
          .eq("trip_id", trip.id)
          .order("created_at", { ascending: false });
        setTickets((data as Ticket[]) ?? []);
      }
      setLoading(false);
    })();
  }, [trip.id, trip.bus_id, trip.driver_id, route.id, userId]);

  const stopName = (id: string) => stops.find((s) => s.id === id)?.name ?? "?";
  const passengers = tickets.reduce((n, t) => n + t.passenger_count, 0);

  return (
    <View style={styles.container}>
      <Pressable onPress={onBack} style={styles.backButton}>
        <Text style={styles.backText}>‹ Atrás</Text>
      </Pressable>
      <Text style={styles.title}>{route.name}</Text>
      <Text style={styles.meta}>
        Bus {bus?.plate ?? "—"} · Chofer {driver?.full_name ?? "—"}
      </Text>
      <Text style={styles.meta}>
        Salida {formatDateTime(trip.departure_at)}
        {trip.ended_at ? ` · Finalizado ${formatTime(trip.ended_at)}` : ""}
      </Text>

      <View style={styles.summary}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{tickets.length}</Text>
          <Text style={styles.summaryLabel}>boletos</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{passengers}</Text>
          <Text style={styles.summaryLabel}>pasajeros</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ gap: 8, paddingBottom: 24 }}
          ListEmptyComponent={<Text style={styles.empty}>Aún no hay boletos en este viaje.</Text>}
          renderItem={({ item }) => (
            <View style={styles.ticket}>
              <View style={{ flex: 1 }}>
                {item.ticket_number && (
                  <Text style={styles.ticketMeta}>{item.ticket_number}</Text>
                )}
                <Text style={styles.ticketRoute}>
                  {stopName(item.boarding_stop_id)} → {stopName(item.alighting_stop_id)}
                </Text>
                <Text style={styles.ticketMeta}>
                  {formatTime(item.created_at)} · {item.passenger_count}{" "}
                  {item.passenger_count === 1 ? "pasajero" : "pasajeros"}
                </Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc", padding: 20 },
  backButton: { marginBottom: 8 },
  backText: { color: "#2a78d6", fontSize: 14 },
  title: { fontSize: 18, fontWeight: "600", color: "#0f172a" },
  meta: { fontSize: 13, color: "#64748b", marginTop: 2 },
  summary: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingVertical: 14,
    marginVertical: 16,
  },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryValue: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  summaryLabel: { fontSize: 12, color: "#64748b", marginTop: 2 },
  empty: { textAlign: "center", color: "#94a3b8", marginTop: 32 },
  ticket: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
  },
  ticketRoute: { fontSize: 14, fontWeight: "600", color: "#0f172a" },
  ticketMeta: { fontSize: 12, color: "#64748b", marginTop: 2 },
});
