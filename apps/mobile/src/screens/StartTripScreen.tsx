import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { loadReference, startLocalTrip } from "../lib/offline";
import { notify } from "../lib/dialogs";
import { directionLabel } from "@trans-chavez/shared";
import type { Bus, Driver, Profile, Route, Trip, TripDirection } from "@trans-chavez/shared";

function nowAsHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Combina la fecha de hoy con una hora HH:MM local. */
function todayAt(hhmm: string): Date | null {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(hhmm.trim());
  if (!match) return null;
  const d = new Date();
  d.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return d;
}

export function StartTripScreen({
  profile,
  onBack,
  onStarted,
}: {
  profile: Profile;
  onBack: () => void;
  onStarted: (trip: Trip, route: Route) => void;
}) {
  const [buses, setBuses] = useState<Bus[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [routeId, setRouteId] = useState<string | null>(null);
  const [direction, setDirection] = useState<TripDirection | null>(null);
  const [busId, setBusId] = useState<string | null>(null);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [time, setTime] = useState(nowAsHHMM());
  const [saving, setSaving] = useState(false);
  const [noData, setNoData] = useState(false);

  useEffect(() => {
    (async () => {
      const ref = await loadReference();
      const routeList = ref?.routes ?? [];
      setBuses(ref?.buses ?? []);
      setDrivers(ref?.drivers ?? []);
      setRoutes(routeList);
      setRouteId((current) => current ?? (routeList.length === 1 ? routeList[0].id : null));
      setNoData(!ref);
      setLoading(false);
    })();
  }, []);

  async function handleStart() {
    const route = routes.find((r) => r.id === routeId);
    const departure = todayAt(time);
    if (!route) return notify("Falta la ruta", "Elige la ruta del viaje.");
    if (!direction) return notify("Falta el sentido", "Elige hacia dónde va el viaje.");
    if (!busId) return notify("Falta el bus", "Elige el bus del viaje.");
    if (!driverId) return notify("Falta el chofer", "Elige el chofer del viaje.");
    if (!departure) return notify("Hora inválida", "Escribe la hora con el formato HH:MM, por ejemplo 06:30.");

    setSaving(true);
    try {
      const trip = await startLocalTrip(profile.id, {
        route_id: route.id,
        direction,
        bus_id: busId,
        driver_id: driverId,
        departure_at: departure.toISOString(),
      });
      onStarted(trip, route);
    } catch (err) {
      notify("No se pudo iniciar el viaje", err instanceof Error ? err.message : "Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  const selectedRoute = routes.find((r) => r.id === routeId);

  const chip = (label: string, active: boolean, onPress: () => void, key: string) => (
    <Pressable key={key} style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Pressable onPress={onBack} style={styles.backButton}>
        <Text style={styles.backText}>‹ Viajes</Text>
      </Pressable>
      <Text style={styles.title}>Iniciar viaje</Text>
      {noData && (
        <Text style={styles.hint}>
          Aún no hay datos guardados en este teléfono. Conéctate a internet una vez para
          descargar rutas, buses y choferes.
        </Text>
      )}

      {routes.length > 1 && (
        <>
          <Text style={styles.sectionLabel}>Ruta</Text>
          <View style={styles.chipRow}>
            {routes.map((r) => chip(r.name, routeId === r.id, () => setRouteId(r.id), r.id))}
          </View>
        </>
      )}

      {selectedRoute && (
        <>
          <Text style={styles.sectionLabel}>Sentido del viaje</Text>
          <View style={styles.chipRow}>
            {(["outbound", "return"] as const).map((dir) =>
              chip(
                directionLabel(selectedRoute, dir),
                direction === dir,
                () => setDirection(dir),
                dir,
              ),
            )}
          </View>
          <Text style={styles.hint}>
            No se puede cambiar después de iniciar el viaje.
          </Text>
        </>
      )}

      <Text style={styles.sectionLabel}>Bus</Text>
      <View style={styles.chipRow}>
        {buses.map((b) =>
          chip(b.name ? `${b.plate} · ${b.name}` : b.plate, busId === b.id, () => setBusId(b.id), b.id),
        )}
        {buses.length === 0 && <Text style={styles.hint}>No hay buses registrados.</Text>}
      </View>

      <Text style={styles.sectionLabel}>Chofer</Text>
      <View style={styles.chipRow}>
        {drivers.map((d) => chip(d.full_name, driverId === d.id, () => setDriverId(d.id), d.id))}
        {drivers.length === 0 && <Text style={styles.hint}>No hay choferes registrados. Pide al administrador que los agregue.</Text>}
      </View>

      <Text style={styles.sectionLabel}>Hora del viaje (HH:MM)</Text>
      <TextInput
        style={styles.input}
        value={time}
        onChangeText={setTime}
        placeholder="06:30"
        keyboardType="numbers-and-punctuation"
        maxLength={5}
      />

      <Pressable
        style={[styles.primaryButton, saving && styles.disabled]}
        onPress={handleStart}
        disabled={saving}
      >
        <Text style={styles.primaryButtonText}>
          {saving ? "Iniciando..." : "Iniciar viaje"}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  backButton: { marginBottom: 8 },
  backText: { color: "#2a78d6", fontSize: 14 },
  title: { fontSize: 18, fontWeight: "600", color: "#0f172a", marginBottom: 8 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
    textTransform: "uppercase",
    marginBottom: 8,
    marginTop: 16,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#fff",
  },
  chipActive: { backgroundColor: "#0f172a", borderColor: "#0f172a" },
  chipText: { fontSize: 13, color: "#334155" },
  chipTextActive: { color: "#fff" },
  hint: { fontSize: 13, color: "#94a3b8" },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    width: 120,
  },
  primaryButton: {
    backgroundColor: "#0f172a",
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 28,
  },
  primaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  disabled: { opacity: 0.5 },
});
