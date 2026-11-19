import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { buildReceiptEscPos, buildReceiptLines } from "@trans-chavez/shared";
import type { ReceiptData } from "@trans-chavez/shared";
import {
  forgetPrinter,
  getSavedPrinter,
  printBytes,
  savePrinter,
  scanPrinters,
} from "../lib/printer";
import type { FoundPrinter } from "../lib/printer";

/**
 * Ticket recién cobrado: vista previa, impresión y selección de impresora.
 * Imprime automáticamente si ya hay una impresora guardada.
 */
export function ReceiptView({ data, onDone }: { data: ReceiptData; onDone: () => void }) {
  const [printer, setPrinter] = useState<FoundPrinter | null>(null);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [printed, setPrinted] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [found, setFound] = useState<FoundPrinter[]>([]);
  const [picking, setPicking] = useState(false);

  async function print() {
    setPrinting(true);
    setError(null);
    try {
      await printBytes(buildReceiptEscPos(data));
      setPrinted(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg === "NO_PRINTER") setPicking(true);
      else setError(msg || "No se pudo imprimir.");
    } finally {
      setPrinting(false);
    }
  }

  useEffect(() => {
    (async () => {
      const saved = await getSavedPrinter();
      setPrinter(saved);
      if (saved) void print();
      else setPicking(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function search() {
    setScanning(true);
    setFound([]);
    setError(null);
    try {
      await scanPrinters((p) => setFound((list) => [...list, p]));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al buscar.");
    } finally {
      setScanning(false);
    }
  }

  async function choose(p: FoundPrinter) {
    await savePrinter(p);
    setPrinter(p);
    setPicking(false);
    void print();
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Boleto vendido</Text>

      <View style={styles.paper}>
        <Text style={styles.paperText}>{buildReceiptLines(data).join("\n")}</Text>
      </View>

      {printed && <Text style={styles.ok}>✓ Impreso</Text>}
      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.primary, printing && styles.disabled]}
        onPress={print}
        disabled={printing || !printer}
      >
        {printing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryText}>{printed ? "Reimprimir" : "Imprimir"}</Text>
        )}
      </Pressable>

      <Pressable style={styles.secondary} onPress={onDone}>
        <Text style={styles.secondaryText}>Listo, nuevo cobro</Text>
      </Pressable>

      <View style={styles.printerBox}>
        <Text style={styles.label}>
          Impresora: {printer ? printer.name : "ninguna configurada"}
        </Text>
        {!picking ? (
          <Pressable onPress={() => setPicking(true)}>
            <Text style={styles.link}>Cambiar impresora</Text>
          </Pressable>
        ) : (
          <View>
            <Pressable style={styles.secondary} onPress={search} disabled={scanning}>
              <Text style={styles.secondaryText}>
                {scanning ? "Buscando..." : "Buscar impresoras por Bluetooth"}
              </Text>
            </Pressable>
            {found.map((p) => (
              <Pressable key={p.id} style={styles.device} onPress={() => choose(p)}>
                <Text style={styles.deviceText}>{p.name}</Text>
              </Pressable>
            ))}
            {printer && (
              <Pressable
                onPress={async () => {
                  await forgetPrinter();
                  setPrinter(null);
                }}
              >
                <Text style={styles.link}>Olvidar impresora guardada</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 20, paddingBottom: 40, gap: 12 },
  title: { fontSize: 20, fontWeight: "700", color: "#0f172a" },
  paper: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 16,
    alignSelf: "center",
  },
  paperText: { fontFamily: "Courier", fontSize: 12, color: "#0f172a", lineHeight: 17 },
  ok: { color: "#16a34a", fontWeight: "600", textAlign: "center" },
  error: { color: "#dc2626", textAlign: "center" },
  primary: { backgroundColor: "#0f172a", borderRadius: 8, paddingVertical: 16, alignItems: "center" },
  primaryText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  disabled: { opacity: 0.5 },
  secondary: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  secondaryText: { color: "#0f172a", fontSize: 15, fontWeight: "600" },
  printerBox: { marginTop: 12, gap: 8 },
  label: { fontSize: 13, color: "#64748b" },
  link: { color: "#2a78d6", fontSize: 14, marginTop: 6 },
  device: { padding: 12, borderBottomWidth: 1, borderBottomColor: "#e2e8f0", backgroundColor: "#fff" },
  deviceText: { fontSize: 15, color: "#0f172a" },
});
