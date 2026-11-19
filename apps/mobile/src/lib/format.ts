export function formatCurrency(value: number): string {
  return `L ${value.toFixed(2)}`;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-HN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-HN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
