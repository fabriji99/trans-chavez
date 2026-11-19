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
        className="w-full rounded-xl border border-red-600 py-3.5 text-base font-semibold text-red-600"
      >
        Finalizar viaje
      </button>
    </form>
  );
}
