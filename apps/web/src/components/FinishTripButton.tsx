"use client";

import { finishTrip } from "@/lib/actions/cobrador";

export function FinishTripButton({ tripId }: { tripId: string }) {
  return (
    <form
      action={finishTrip}
      onSubmit={(e) => {
        if (!window.confirm("Ya no podrás vender más boletos en este viaje. ¿Finalizar?")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="trip_id" value={tripId} />
      <button
        type="submit"
        className="min-h-[52px] w-full rounded-2xl border border-red-300 bg-red-50 font-display text-sm font-bold text-red-600 hover:bg-red-100"
      >
        Finalizar viaje
      </button>
    </form>
  );
}
