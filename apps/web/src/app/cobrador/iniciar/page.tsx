import Link from "next/link";
import { redirect } from "next/navigation";
import { requireCobrador } from "@/lib/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { StartTripForm } from "@/components/StartTripForm";
import type { Bus, Driver, Route } from "@trans-chavez/shared";

export default async function IniciarViajePage() {
  const profile = await requireCobrador();
  const supabase = await createSupabaseServerClient();

  // Un solo viaje en curso a la vez: si ya hay uno, se retoma
  const { data: open } = await supabase
    .from("trips")
    .select("id")
    .eq("cobrador_id", profile.id)
    .eq("status", "in_progress")
    .limit(1);
  if (open && open.length > 0) redirect(`/cobrador/viaje/${open[0].id}`);

  const [{ data: routes }, { data: buses }, { data: drivers }] = await Promise.all([
    supabase.from("routes").select("*").eq("active", true).order("name"),
    supabase.from("buses").select("*").eq("active", true).order("plate"),
    supabase.from("drivers").select("*").eq("active", true).order("full_name"),
  ]);

  return (
    <div>
      <Link href="/cobrador" className="text-sm font-semibold text-blue-600">
        ‹ Viajes
      </Link>
      <h1 className="mt-2 font-display text-lg font-bold text-slate-900">Iniciar viaje</h1>
      <StartTripForm
        routes={(routes as Route[] | null) ?? []}
        buses={(buses as Bus[] | null) ?? []}
        drivers={(drivers as Driver[] | null) ?? []}
      />
    </div>
  );
}
