import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  addLocalTicket,
  finishLocalTrip,
  loadReference,
} from "../lib/offline";
import { SyncBanner } from "../components/SyncBanner";
import { ReceiptView } from "../components/ReceiptView";
import { confirmAction, notify } from "../lib/dialogs";
import { formatCurrency } from "../lib/format";
import {
  calculateSegmentPrice,
  calculateTicketTotal,
  newTicketSchema,
  directionLabel,
  orderStopsForDirection,
  stopsAfter,
  FareLookupError,
  isTripOverdue,
  TRIP_OPEN_ALERT_MINUTES,
} from "@trans-chavez/shared";
import type { Profile, ReceiptData, Route, Stop, StopPrice, Trip } from "@trans-chavez/shared";

export function TicketScreen({
  trip,
  route,
  profile,
  onBack,
  onViewTickets,
}: {
  trip: Trip;
  route: Route;
  profile: Profile;
  onBack: () => void;
  onViewTickets: () => void;
}) {
  const [finishing, setFinishing] = useState(false);
  const [stops, setStops] = useState<Stop[]>([]);
  const [stopPrices, setStopPrices] = useState<StopPrice[]>([]);
  const [loading, setLoading] = useState(true);
  // El sentido se define al iniciar el viaje y no cambia
  const direction = trip.direction;
  const [boardingId, setBoardingId] = useState<string | null>(null);
  const [alightingId, setAlightingId] = useState<string | null>(null);
  const [passengerCount, setPassengerCount] = useState(1);
  const [saving, setSaving] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  useEffect(() => {
    (async () => {
      const ref = await loadReference();
      const loadedStops = (ref?.stops ?? [])
        .filter((s) => s.route_id === route.id)
        .sort((a, b) => a.sequence - b.sequence);
      const ids = new Set(loadedStops.map((s) => s.id));
      setStops(loadedStops);
      setStopPrices((ref?.stopPrices ?? []).filter((p) => ids.has(p.stop_id)));
      setLoading(false);
    })();
  }, [route.id]);

  // Paradas en el orden del sentido del viaje (la vuelta va invertida)
  const orderedStops = useMemo(
    () => orderStopsForDirection(stops, direction),
    [stops, direction],
  );

  // Solo se puede bajar en paradas posteriores a la de subida, con su precio
  const alightingOptions = useMemo(() => {
    if (!boardingId) return [];
    return stopsAfter(orderedStops, boardingId).map((stop) => {
      try {
        const price = calculateSegmentPrice(
          orderedStops,
          stopPrices,
          direction,
          boardingId,
          stop.id,
        );
        return { stop, price };
      } catch {
        return { stop, price: null };
      }
    });
  }, [boardingId, direction, orderedStops, stopPrices]);

  const fare = useMemo(
    () => alightingOptions.find((o) => o.stop.id === alightingId)?.price ?? null,
    [alightingOptions, alightingId],
  );

  const total = fare ? calculateTicketTotal(fare, passengerCount) : null;

  async function handleConfirm() {
    if (!fare || !boardingId || !alightingId) return;
    setSaving(true);
    try {
      const input = newTicketSchema.parse({
        trip_id: trip.id,
        boarding_stop_id: boardingId,
        alighting_stop_id: alightingId,
        passenger_count: passengerCount,
        fare_amount: fare,
        payment_method: "cash",
        created_by: profile.id,
      });
      const ticket = await addLocalTicket(profile.id, profile.code, trip, input);

      setReceipt({
        company: "Trans. Chávez",
        ticketNumber: ticket.ticket_number ?? "",
        createdAt: ticket.created_at,
        routeLabel: directionLabel(route, direction),
        boarding: orderedStops.find((s) => s.id === boardingId)?.name ?? "",
        alighting: orderedStops.find((s) => s.id === alightingId)?.name ?? "",
        passengers: passengerCount,
        unitPrice: fare,
        total: total ?? 0,
        collectorCode: profile.code,
      });
      setBoardingId(null);
      setAlightingId(null);
      setPassengerCount(1);
    } catch (err) {
      const message =
        err instanceof FareLookupError || err instanceof Error
          ? err.message
          : "No se pudo registrar el boleto.";
      notify("Error", message);
    } finally {
      setSaving(false);
    }
  }

  async function handleFinish() {
    const ok = await confirmAction(
      "Finalizar viaje",
      "Ya no podrás vender más boletos en este viaje. ¿Finalizar?",
      "Finalizar",
    );
    if (!ok) return;
    setFinishing(true);
    try {
      await finishLocalTrip(profile.id, trip);
    } catch (err) {
      setFinishing(false);
      return notify(
        "No se pudo finalizar el viaje",
        err instanceof Error ? err.message : "Intenta de nuevo.",
      );
    }
    setFinishing(false);
    onBack();
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (receipt) {
    return <ReceiptView data={receipt} onDone={() => setReceipt(null)} />;
  }

  return (
    <View style={{ flex: 1 }}>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <Pressable onPress={onBack} style={styles.backButton}>
        <Text style={styles.backText}>‹ Viajes</Text>
      </Pressable>
      <Text style={styles.title}>
        {directionLabel(route, direction)}
      </Text>
      <SyncBanner userId={profile.id} />
      {isTripOverdue(trip) && (
        <View style={styles.overdue}>
          <Text style={styles.overdueText}>
            Este viaje lleva más de {TRIP_OPEN_ALERT_MINUTES} minutos abierto. Si ya terminó, finalízalo.
          </Text>
        </View>
      )}

      <Text style={styles.sectionLabel}>Sube en</Text>
      <View style={styles.chipRow}>
        {orderedStops.slice(0, -1).map((stop) => (
          <Pressable
            key={stop.id}
            style={[styles.chip, boardingId === stop.id && styles.chipActive]}
            onPress={() => {
              setBoardingId(stop.id);
              setAlightingId(null);
            }}
          >
            <Text
              style={[
                styles.chipText,
                boardingId === stop.id && styles.chipTextActive,
              ]}
            >
              {stop.name}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionLabel}>Baja en</Text>
      {boardingId ? (
        <View style={styles.chipRow}>
          {alightingOptions.map(({ stop, price }) => (
            <Pressable
              key={stop.id}
              disabled={price === null}
              style={[
                styles.chip,
                alightingId === stop.id && styles.chipActive,
                price === null && styles.chipDisabled,
              ]}
              onPress={() => setAlightingId(stop.id)}
            >
              <Text
                style={[
                  styles.chipText,
                  alightingId === stop.id && styles.chipTextActive,
                ]}
              >
                {stop.name}
                {price !== null ? `  ·  ${formatCurrency(price)}` : "  ·  sin precio"}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Text style={styles.hint}>Primero elige dónde sube el pasajero.</Text>
      )}

      <Text style={styles.sectionLabel}>Pasajeros</Text>
      <View style={styles.stepper}>
        <Pressable
          style={styles.stepperButton}
          onPress={() => setPassengerCount((n) => Math.max(1, n - 1))}
        >
          <Text style={styles.stepperButtonText}>−</Text>
        </Pressable>
        <Text style={styles.stepperValue}>{passengerCount}</Text>
        <Pressable
          style={styles.stepperButton}
          onPress={() => setPassengerCount((n) => n + 1)}
        >
          <Text style={styles.stepperButtonText}>+</Text>
        </Pressable>
      </View>

      <View style={styles.footerActions}>
        <Pressable style={styles.secondaryButton} onPress={onViewTickets}>
          <Text style={styles.secondaryButtonText}>Ver boletos del viaje</Text>
        </Pressable>
        <Pressable
          style={[styles.finishButton, finishing && styles.confirmButtonDisabled]}
          onPress={handleFinish}
          disabled={finishing}
        >
          <Text style={styles.finishButtonText}>
            {finishing ? "Finalizando..." : "Finalizar viaje"}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
    <View style={styles.footerBar}>
      <View style={styles.totalBox}>
        <Text style={styles.totalLabel}>Total a cobrar</Text>
        <Text style={styles.totalValue}>
          {total !== null ? formatCurrency(total) : "—"}
        </Text>
      </View>

      <Pressable
        style={[
          styles.confirmButton,
          (!total || saving) && styles.confirmButtonDisabled,
        ]}
        onPress={handleConfirm}
        disabled={!total || saving}
      >
        <Text style={styles.confirmButtonText}>
          {saving ? "Guardando..." : `Confirmar cobro${total !== null ? ` • ${formatCurrency(total)}` : ""}`}
        </Text>
      </Pressable>

    </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footerBar: {
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#dce7e4",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
  },
  overdue: {
    backgroundColor: "#fee2e2",
    borderColor: "#ef4444",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  overdueText: { color: "#991b1b", fontSize: 13, fontWeight: "600" },
  container: { flex: 1, backgroundColor: "#f3f8f7", padding: 20 },
  scroll: { flex: 1, backgroundColor: "#f3f8f7" },
  scrollContent: { padding: 20, paddingBottom: 40 },
  footerActions: { marginTop: 28, gap: 10 },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#b8ccc8",
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryButtonText: { color: "#0e2a47", fontSize: 15, fontWeight: "600" },
  finishButton: {
    borderWidth: 1,
    borderColor: "#dc2626",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  finishButtonText: { color: "#dc2626", fontSize: 15, fontWeight: "600" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  backButton: { marginBottom: 8 },
  backText: { color: "#0f8a7d", fontSize: 14 },
  title: { fontSize: 18, fontWeight: "600", color: "#0e2a47", marginBottom: 16 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#5b6b7b",
    textTransform: "uppercase",
    marginBottom: 8,
    marginTop: 12,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: "#b8ccc8",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#fff",
  },
  chipActive: { backgroundColor: "#0f8a7d", borderColor: "#0e2a47" },
  directionButton: {
    backgroundColor: "#0f8a7d",
    borderRadius: 12,
    paddingVertical: 24,
    alignItems: "center",
    marginBottom: 12,
  },
  directionButtonText: { color: "#fff", fontSize: 18, fontWeight: "600" },
  chipDisabled: { opacity: 0.4 },
  hint: { fontSize: 13, color: "#8a9bab" },
  chipText: { fontSize: 13, color: "#334155" },
  chipTextActive: { color: "#0f8a7d", fontWeight: "700" },
  stepper: { flexDirection: "row", alignItems: "center", gap: 16 },
  stepperButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#b8ccc8",
    alignItems: "center",
    justifyContent: "center",
  },
  stepperButtonText: { fontSize: 20, color: "#0e2a47" },
  stepperValue: { fontSize: 18, fontWeight: "600", color: "#0e2a47", minWidth: 24, textAlign: "center" },
  totalBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  totalLabel: { fontSize: 14, color: "#5b6b7b" },
  totalValue: { fontSize: 24, fontWeight: "800", color: "#0e2a47" },
  confirmButton: {
    backgroundColor: "#0f8a7d",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  confirmButtonDisabled: { opacity: 0.5 },
  confirmButtonText: { color: "#fff", fontSize: 16, fontWeight: "800" },
});
