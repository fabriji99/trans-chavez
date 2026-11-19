import { BleManager, Device, Characteristic } from "react-native-ble-plx";
import { PermissionsAndroid, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Impresora térmica por Bluetooth Low Energy (BLE).
 * Importante: iPhone solo puede hablar con impresoras BLE (no con Bluetooth
 * clásico/SPP), por eso la impresora que se compre debe soportar BLE.
 */

const SAVED_KEY = "printer:device";
const CHUNK = 100; // bytes por escritura
const CHUNK_DELAY_MS = 30;

let manager: BleManager | null = null;
const ble = () => (manager ??= new BleManager());

export interface FoundPrinter {
  id: string;
  name: string;
}

export async function getSavedPrinter(): Promise<FoundPrinter | null> {
  const raw = await AsyncStorage.getItem(SAVED_KEY);
  return raw ? (JSON.parse(raw) as FoundPrinter) : null;
}

export async function savePrinter(p: FoundPrinter): Promise<void> {
  await AsyncStorage.setItem(SAVED_KEY, JSON.stringify(p));
}

export async function forgetPrinter(): Promise<void> {
  await AsyncStorage.removeItem(SAVED_KEY);
}

async function ensurePermissions(): Promise<void> {
  if (Platform.OS !== "android") return;
  const perms =
    Number(Platform.Version) >= 31
      ? [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
  const res = await PermissionsAndroid.requestMultiple(perms);
  if (Object.values(res).some((r) => r !== PermissionsAndroid.RESULTS.GRANTED)) {
    throw new Error("Falta el permiso de Bluetooth para buscar la impresora.");
  }
}

/** Busca dispositivos BLE cercanos durante `ms` milisegundos. */
export async function scanPrinters(
  onFound: (p: FoundPrinter) => void,
  ms = 8000,
): Promise<void> {
  await ensurePermissions();
  const seen = new Set<string>();
  await new Promise<void>((resolve, reject) => {
    ble().startDeviceScan(null, null, (error, device) => {
      if (error) {
        ble().stopDeviceScan();
        reject(new Error("No se pudo buscar por Bluetooth. ¿Está encendido?"));
        return;
      }
      const name = device?.name ?? device?.localName;
      if (device && name && !seen.has(device.id)) {
        seen.add(device.id);
        onFound({ id: device.id, name });
      }
    });
    setTimeout(() => {
      ble().stopDeviceScan();
      resolve();
    }, ms);
  });
}

function toBase64(bytes: Uint8Array): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const [a, b, c] = [bytes[i], bytes[i + 1], bytes[i + 2]];
    out += chars[a >> 2] + chars[((a & 3) << 4) | ((b ?? 0) >> 4)];
    out += b === undefined ? "=" : chars[((b & 15) << 2) | ((c ?? 0) >> 6)];
    out += c === undefined ? "=" : chars[c & 63];
  }
  return out;
}

/** Busca la primera característica en la que se puede escribir (la de la impresora). */
async function findWritable(device: Device): Promise<Characteristic> {
  const services = await device.services();
  for (const service of services) {
    for (const ch of await service.characteristics()) {
      if (ch.isWritableWithoutResponse || ch.isWritableWithResponse) return ch;
    }
  }
  throw new Error("Este dispositivo no parece una impresora (no acepta datos).");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Envía los bytes a la impresora guardada. Conecta, imprime y desconecta. */
export async function printBytes(bytes: Uint8Array): Promise<void> {
  const saved = await getSavedPrinter();
  if (!saved) throw new Error("NO_PRINTER");
  await ensurePermissions();

  let device: Device | null = null;
  try {
    device = await ble().connectToDevice(saved.id, { timeout: 8000 });
    await device.discoverAllServicesAndCharacteristics();
    const ch = await findWritable(device);
    for (let i = 0; i < bytes.length; i += CHUNK) {
      const part = toBase64(bytes.slice(i, i + CHUNK));
      if (ch.isWritableWithoutResponse) {
        await ch.writeWithoutResponse(part);
      } else {
        await ch.writeWithResponse(part);
      }
      await sleep(CHUNK_DELAY_MS);
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Este dispositivo")) throw err;
    throw new Error("No se pudo imprimir. Revisa que la impresora esté encendida y cerca.");
  } finally {
    try {
      await device?.cancelConnection();
    } catch {
      /* ya desconectada */
    }
  }
}
