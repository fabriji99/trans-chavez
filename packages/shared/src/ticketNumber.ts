/** Día de Honduras (UTC-6, sin horario de verano) de una fecha, como YYYY-MM-DD. */
export function hondurasDay(date: string | Date): string {
  const ms = (typeof date === "string" ? new Date(date) : date).getTime() - 6 * 3600_000;
  return new Date(ms).toISOString().slice(0, 10);
}

/** Prefijo de los boletos de un cobrador en un día: C01-061026 (cobrador, DDMMYY). */
export function ticketPrefix(code: string, day: string): string {
  const [y, m, d] = day.split("-");
  return `${code}-${d}${m}${y.slice(2)}`;
}

/** Número de boleto: C01-061026-0007. */
export function formatTicketNumber(code: string, day: string, seq: number): string {
  return `${ticketPrefix(code, day)}-${String(seq).padStart(4, "0")}`;
}

/** Consecutivo de un número de boleto con el prefijo dado, o null si no corresponde. */
export function ticketSeq(ticketNumber: string, prefix: string): number | null {
  if (!ticketNumber.startsWith(`${prefix}-`)) return null;
  const n = Number(ticketNumber.slice(prefix.length + 1));
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Consecutivos que faltan entre 1 y el mayor encontrado. */
export function missingSeqs(seqs: number[]): number[] {
  const have = new Set(seqs);
  const max = Math.max(0, ...seqs);
  const missing: number[] = [];
  for (let i = 1; i <= max; i++) if (!have.has(i)) missing.push(i);
  return missing;
}
