/**
 * Ticket del pasajero para impresora térmica de 58 mm (32 columnas, ESC/POS).
 * Código puro (sin dependencias de React Native): sirve para la vista previa en
 * pantalla y para generar los bytes que se envían a la impresora.
 */

export interface ReceiptData {
  company: string;
  ticketNumber: string;
  /** ISO de creación del boleto */
  createdAt: string;
  routeLabel: string;
  boarding: string;
  alighting: string;
  passengers: number;
  unitPrice: number;
  total: number;
  collectorCode: string | null;
}

export const RECEIPT_COLUMNS = 32;

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Fecha y hora de Honduras (UTC-6, sin horario de verano): DD/MM/YYYY HH:MM */
export function hondurasDateTime(iso: string): string {
  const d = new Date(new Date(iso).getTime() - 6 * 3600_000);
  return (
    `${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ` +
    `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`
  );
}

/** La impresora no tiene la flecha; se imprime como guion. */
const plain = (s: string) => s.replace(/\s*→\s*/g, " - ");

const money = (n: number) => `L ${n.toFixed(2)}`;

function center(text: string, cols: number): string {
  const t = text.slice(0, cols);
  return " ".repeat(Math.floor((cols - t.length) / 2)) + t;
}

function leftRight(left: string, right: string, cols: number): string {
  const space = Math.max(1, cols - left.length - right.length);
  return (left + " ".repeat(space) + right).slice(0, cols);
}

/** Parte un texto largo en líneas de ancho `cols`, cortando por palabras. */
function wrap(text: string, cols: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (!line) line = word;
    else if (line.length + 1 + word.length <= cols) line += ` ${word}`;
    else {
      out.push(line);
      line = word;
    }
    while (line.length > cols) {
      out.push(line.slice(0, cols));
      line = line.slice(cols);
    }
  }
  if (line) out.push(line);
  return out;
}

/** Líneas del ticket, tal como se ven impresas (para la vista previa). */
export function buildReceiptLines(d: ReceiptData, cols = RECEIPT_COLUMNS): string[] {
  const sep = "-".repeat(cols);
  const lines: string[] = [
    center(d.company.toUpperCase(), cols),
    center("BOLETO DE PASAJE", cols),
    sep,
    d.ticketNumber,
    hondurasDateTime(d.createdAt),
    ...wrap(plain(d.routeLabel), cols),
    sep,
    ...wrap(`Sube: ${d.boarding}`, cols),
    ...wrap(`Baja: ${d.alighting}`, cols),
    sep,
    leftRight("Pasajeros", String(d.passengers), cols),
    leftRight("Precio c/u", money(d.unitPrice), cols),
    leftRight("TOTAL", money(d.total), cols),
    sep,
  ];
  if (d.collectorCode) lines.push(`Cobrador: ${d.collectorCode}`);
  lines.push(center("Gracias por viajar con nosotros", cols));
  return lines;
}

// Página de códigos CP858 (soporta acentos del español). ESC t 19.
const CP858: Record<string, number> = {
  "á": 0xa0, "é": 0x82, "í": 0xa1, "ó": 0xa2, "ú": 0xa3, "ñ": 0xa4,
  "Ñ": 0xa5, "¿": 0xa8, "¡": 0xad, "Á": 0xb5, "É": 0x90, "Í": 0xd6,
  "Ó": 0xe0, "Ú": 0xe9, "ü": 0x81, "Ü": 0x9a,
};

function encodeText(text: string): number[] {
  const bytes: number[] = [];
  for (const ch of text) {
    const mapped = CP858[ch];
    if (mapped !== undefined) bytes.push(mapped);
    else {
      const code = ch.charCodeAt(0);
      bytes.push(code >= 0x20 && code < 0x7f ? code : 0x3f); // "?" si no se puede
    }
  }
  return bytes;
}

/** Bytes ESC/POS listos para enviar a la impresora. */
export function buildReceiptEscPos(d: ReceiptData, cols = RECEIPT_COLUMNS): Uint8Array {
  const out: number[] = [];
  const ESC = 0x1b;
  const GS = 0x1d;
  const text = (s: string) => out.push(...encodeText(s), 0x0a);

  out.push(ESC, 0x40); // inicializar
  out.push(ESC, 0x74, 19); // CP858

  const sep = "-".repeat(cols);

  out.push(ESC, 0x61, 1); // centrar
  out.push(ESC, 0x45, 1); // negrita
  out.push(GS, 0x21, 0x11); // doble ancho y alto
  text(d.company.toUpperCase());
  out.push(GS, 0x21, 0x00);
  text("BOLETO DE PASAJE");
  out.push(ESC, 0x45, 0);

  out.push(ESC, 0x61, 0); // izquierda
  text(sep);
  out.push(ESC, 0x45, 1);
  text(d.ticketNumber);
  out.push(ESC, 0x45, 0);
  text(hondurasDateTime(d.createdAt));
  for (const l of wrap(plain(d.routeLabel), cols)) text(l);
  text(sep);
  for (const l of wrap(`Sube: ${d.boarding}`, cols)) text(l);
  for (const l of wrap(`Baja: ${d.alighting}`, cols)) text(l);
  text(sep);
  text(leftRight("Pasajeros", String(d.passengers), cols));
  text(leftRight("Precio c/u", money(d.unitPrice), cols));

  out.push(ESC, 0x45, 1);
  out.push(GS, 0x21, 0x01); // doble alto para el total
  text(leftRight("TOTAL", money(d.total), cols));
  out.push(GS, 0x21, 0x00);
  out.push(ESC, 0x45, 0);
  text(sep);

  if (d.collectorCode) text(`Cobrador: ${d.collectorCode}`);
  out.push(ESC, 0x61, 1);
  text("Gracias por viajar con nosotros");
  out.push(ESC, 0x64, 4); // avanzar 4 líneas para poder cortar el papel
  return Uint8Array.from(out);
}
