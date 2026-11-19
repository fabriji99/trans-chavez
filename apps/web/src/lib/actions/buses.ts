"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "../supabase/server";
import { requireAdmin } from "../dal";

export async function createBus(formData: FormData) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const plate = String(formData.get("plate") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim() || null;
  const capacity = Number(formData.get("capacity") ?? 40);

  if (!plate) throw new Error("La placa es requerida.");

  const { error } = await supabase.from("buses").insert({
    plate,
    name,
    capacity,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/buses");
}

export async function deleteBus(formData: FormData) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const id = String(formData.get("id"));

  const { error } = await supabase.from("buses").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/buses");
}
