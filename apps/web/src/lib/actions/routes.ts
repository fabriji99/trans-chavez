"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "../supabase/server";
import { requireAdmin } from "../dal";
import {
  newRouteSchema,
  newStopSchema,
  stopPriceSchema,
} from "@trans-chavez/shared";

export async function createRoute(formData: FormData) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const input = newRouteSchema.parse({
    name: formData.get("name"),
    origin: formData.get("origin"),
    destination: formData.get("destination"),
  });

  const { error } = await supabase.from("routes").insert(input);
  if (error) throw new Error(error.message);

  revalidatePath("/rutas");
}

export async function createStop(formData: FormData) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const input = newStopSchema.parse({
    route_id: formData.get("route_id"),
    name: formData.get("name"),
    sequence: Number(formData.get("sequence")),
  });

  const { error } = await supabase.from("stops").insert(input);
  if (error) throw new Error(error.message);

  revalidatePath("/rutas");
}

/** Guarda de una sola vez los precios "hasta el final" de todas las paradas de una ruta, ida y vuelta. */
export async function saveStopPrices(formData: FormData) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const rows = [];
  for (const [key, value] of formData.entries()) {
    const match = /^price__([^_]+)__(outbound|return)$/.exec(key);
    if (!match || String(value).trim() === "") continue;
    rows.push(
      stopPriceSchema.parse({
        stop_id: match[1],
        direction: match[2],
        price_to_end: Number(value),
      }),
    );
  }
  if (rows.length === 0) return;

  const { error } = await supabase
    .from("stop_prices")
    .upsert(rows, { onConflict: "stop_id,direction" });
  if (error) throw new Error(error.message);

  revalidatePath("/rutas");
}

export async function deleteRoute(formData: FormData) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const id = String(formData.get("id"));

  const { error } = await supabase.from("routes").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/rutas");
}
