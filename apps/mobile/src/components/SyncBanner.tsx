import { Pressable, StyleSheet, Text, View } from "react-native";
import { syncPending, usePendingSync } from "../lib/offline";

/** Aviso de viajes guardados en el teléfono que todavía no se han enviado al servidor. */
export function SyncBanner({ userId }: { userId: string }) {
  const { trips, error } = usePendingSync(userId);
  if (trips === 0) return null;
  return (
    <View style={styles.banner}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>
          {trips === 1 ? "Viaje sin sincronizar" : `${trips} viajes sin sincronizar`}
        </Text>
        <Text style={styles.text}>
          Está guardado en este teléfono y se enviará solo cuando haya señal.
        </Text>
        {error && <Text style={styles.error}>Motivo: {error}</Text>}
      </View>
      <Pressable style={styles.button} onPress={() => void syncPending(userId)}>
        <Text style={styles.buttonText}>Reintentar</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fef3c7",
    borderColor: "#f59e0b",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  title: { fontWeight: "700", color: "#92400e", fontSize: 14 },
  text: { color: "#92400e", fontSize: 12, marginTop: 2 },
  error: { color: "#b91c1c", fontSize: 12, marginTop: 4 },
  button: { backgroundColor: "#f59e0b", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 13 },
});
