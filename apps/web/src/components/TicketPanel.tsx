"use client";

import { useMemo, useState, useTransition } from "react";
import { createTicket } from "@/lib/actions/cobrador";
import { Chip } from "./Chip";
import { BottomAction } from "./BottomAction";
import {
  buildReceiptLines,
  calculateSegmentPrice,
  calculateTicketTotal,
  orderStopsForDirection,
  stopsAfter,
} from "@trans-chavez/shared";
import type { ReceiptData, Stop, StopPrice, TripDirection } from "@trans-chavez/shared";

const money = (n: number) => `L ${n.toFixed(2)}`;
const label = "mb-2 text-xs font-bold uppercase tracking-wider text-slate-500";
const card = "rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs";

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

  return (
    <div className="pb-2">
      <div className={card}>
        <p className={label}>Sube en</p>
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
      </div>

      <div className={`${card} mt-3`}>
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
      </div>

      <div className={`${card} mt-3 flex items-center justify-between`}>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Pasajeros</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPassengers((n) => Math.max(1, n - 1))}
            aria-label="Quitar pasajero"
            className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 font-display text-xl font-bold text-slate-900 active:scale-95"
          >
            −
          </button>
          <span className="tabular w-8 text-center font-display text-lg font-extrabold text-slate-900">{passengers}</span>
          <button
            type="button"
            onClick={() => setPassengers((n) => Math.min(99, n + 1))}
            aria-label="Agregar pasajero"
            className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 font-display text-xl font-bold text-white active:scale-95"
          >
            +
          </button>
        </div>
      </div>

      <div className={`${card} mt-3 flex items-center justify-between`}>
        <span className="text-sm text-slate-500">Total a cobrar</span>
        <span className="tabular font-display text-2xl font-extrabold text-slate-900">
          {total !== null ? money(total) : "—"}
        </span>
      </div>

      {error && (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <BottomAction>
        <button
          type="button"
          onClick={confirm}
          disabled={!total || pending}
          className="tabular flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 font-display text-base font-bold text-white shadow-lg shadow-blue-600/25 active:scale-[0.99] disabled:bg-slate-300 disabled:shadow-none"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {pending ? "Guardando..." : `Confirmar cobro${total !== null ? ` • ${money(total)}` : ""}`}
        </button>
      </BottomAction>

      {receipt && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/65 p-3 backdrop-blur-xs sm:items-center">
          <div className="animate-slide-up flex max-h-[92%] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="bg-emerald-500 px-5 py-4 text-center text-white">
              <div className="mx-auto mb-1.5 flex h-11 w-11 items-center justify-center rounded-full bg-white/20">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h3 className="font-display text-lg font-extrabold tracking-tight">Boleto registrado</h3>
              <p className="mt-0.5 font-mono text-xs text-emerald-50">{receipt.ticketNumber}</p>
            </div>

            <div className="overflow-y-auto p-4 no-scrollbar">
              <pre className="print-receipt mx-auto w-fit rounded-2xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-5 text-slate-900">
                {buildReceiptLines(receipt).join("\n")}
              </pre>
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-slate-200 bg-slate-50 p-3.5">
              <button
                type="button"
                onClick={() => window.print()}
                className="min-h-[48px] rounded-xl border border-slate-300 bg-white font-display text-xs font-bold text-slate-900 hover:bg-slate-100"
              >
                Imprimir / PDF
              </button>
              <button
                type="button"
                onClick={() => setReceipt(null)}
                className="min-h-[48px] rounded-xl bg-blue-600 font-display text-xs font-bold text-white shadow-md shadow-blue-600/20 hover:bg-blue-700"
              >
                Nuevo cobro +
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
