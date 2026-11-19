"use client";

import { useMemo, useState, useTransition } from "react";
import { createTicket } from "@/lib/actions/cobrador";
import { Chip } from "./Chip";
import {
  buildReceiptLines,
  calculateSegmentPrice,
  calculateTicketTotal,
  orderStopsForDirection,
  stopsAfter,
} from "@trans-chavez/shared";
import type { ReceiptData, Stop, StopPrice, TripDirection } from "@trans-chavez/shared";

const money = (n: number) => `L ${n.toFixed(2)}`;
const label = "mb-2 mt-5 text-xs font-semibold uppercase text-slate-500";

export function TicketPanel({
  tripId,
  direction,
  stops,
  stopPrices,
}: {
  tripId: string;
  direction: TripDirection;
  stops: Stop[];
  stopPrices: StopPrice[];
}) {
  const [boardingId, setBoardingId] = useState<string | null>(null);
  const [alightingId, setAlightingId] = useState<string | null>(null);
  const [passengers, setPassengers] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [pending, startTransition] = useTransition();

  const ordered = useMemo(() => orderStopsForDirection(stops, direction), [stops, direction]);

  const alightingOptions = useMemo(() => {
    if (!boardingId) return [];
    return stopsAfter(ordered, boardingId).map((stop) => {
      try {
        return { stop, price: calculateSegmentPrice(ordered, stopPrices, direction, boardingId, stop.id) };
      } catch {
        return { stop, price: null };
      }
    });
  }, [boardingId, direction, ordered, stopPrices]);

  const fare = alightingOptions.find((o) => o.stop.id === alightingId)?.price ?? null;
  const total = fare ? calculateTicketTotal(fare, passengers) : null;

  function confirm() {
    if (!boardingId || !alightingId) return;
    setError(null);
    startTransition(async () => {
      const result = await createTicket({ tripId, boardingId, alightingId, passengers });
      if (result.error || !result.receipt) {
        setError(result.error ?? "No se pudo registrar el boleto.");
        return;
      }
      setReceipt(result.receipt);
      setBoardingId(null);
      setAlightingId(null);
      setPassengers(1);
    });
  }

  if (receipt) {
    return (
      <div>
        <p className="mb-3 text-center text-sm font-semibold text-green-700">Boleto registrado</p>
        <pre className="print-receipt mx-auto w-fit rounded-lg border border-slate-200 bg-white p-4 font-mono text-xs leading-5 text-slate-900">
          {buildReceiptLines(receipt).join("\n")}
        </pre>
        <button
          type="button"
          onClick={() => window.print()}
          className="mt-4 w-full rounded-xl border border-slate-300 bg-white py-3.5 text-base font-semibold text-slate-900"
        >
          Imprimir / guardar PDF
        </button>
        <button
          type="button"
          onClick={() => setReceipt(null)}
          className="mt-3 w-full rounded-xl bg-slate-900 py-4 text-base font-semibold text-white"
        >
          Listo, nuevo cobro
        </button>
      </div>
    );
  }

  return (
    <div>
      <p className={label.replace("mt-5", "mt-1")}>Sube en</p>
      <div className="flex flex-wrap gap-2">
        {ordered.slice(0, -1).map((stop) => (
          <Chip
            key={stop.id}
            label={stop.name}
            active={boardingId === stop.id}
            onClick={() => {
              setBoardingId(stop.id);
              setAlightingId(null);
            }}
          />
        ))}
      </div>

      <p className={label}>Baja en</p>
      {boardingId ? (
        <div className="flex flex-wrap gap-2">
          {alightingOptions.map(({ stop, price }) => (
            <Chip
              key={stop.id}
              label={`${stop.name}  ·  ${price !== null ? money(price) : "sin precio"}`}
              active={alightingId === stop.id}
              disabled={price === null}
              onClick={() => setAlightingId(stop.id)}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-400">Primero elige dónde sube el pasajero.</p>
      )}

      <p className={label}>Pasajeros</p>
      <div className="flex items-center gap-5">
        <button
          type="button"
          onClick={() => setPassengers((n) => Math.max(1, n - 1))}
          className="h-12 w-12 rounded-full border border-slate-300 bg-white text-2xl text-slate-900"
        >
          −
        </button>
        <span className="min-w-6 text-center text-xl font-semibold text-slate-900">{passengers}</span>
        <button
          type="button"
          onClick={() => setPassengers((n) => Math.min(99, n + 1))}
          className="h-12 w-12 rounded-full border border-slate-300 bg-white text-2xl text-slate-900"
        >
          +
        </button>
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 text-center">
        <p className="text-sm text-slate-500">Total a cobrar</p>
        <p className="mt-1 text-3xl font-bold text-slate-900">{total !== null ? money(total) : "—"}</p>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={confirm}
        disabled={!total || pending}
        className="mt-4 w-full rounded-xl bg-slate-900 py-4 text-base font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Guardando..." : "Confirmar cobro"}
      </button>
    </div>
  );
}
