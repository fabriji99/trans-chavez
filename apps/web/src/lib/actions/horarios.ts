"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "../supabase/server";
import { requireAdmin } from "../dal";

export async function createSchedule(formData: FormData) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const routeId = String(formData.get("route_id") ?? "");
  const direction = String(formData.get("direction") ?? "");
  const time = String(formData.get("depart_time") ?? "").trim();

  if (!routeId) throw new Error("Elige la ruta.");
  if (direction !== "outbound" && direction !== "return") throw new Error("Elige el sentido.");
  if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error("La hora debe tener el formato HH:MM, por ejemplo 06:30.");

  const { error } = await supabase
    .from("route_schedules")
    .insert({ route_id: routeId, direction, depart_time: time });
  if (error) {
    throw new Error(error.message.includes("duplicate") ? "Ese horario ya existe." : error.message);
  }
  revalidatePath("/horarios");
}

export async function deleteSchedule(formData: FormData) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("route_schedules").delete().eq("id", String(formData.get("id")));
  if (error) throw new Error(error.message);
  revalidatePath("/horarios");
}
