"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "../supabase/server";
import { requireAdmin } from "../dal";
import { newDriverSchema } from "@trans-chavez/shared";

export async function createDriver(formData: FormData) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const input = newDriverSchema.parse({
    full_name: formData.get("full_name"),
    phone: String(formData.get("phone") ?? "").trim() || null,
  });

  const { error } = await supabase.from("drivers").insert(input);
  if (error) throw new Error(error.message);

  revalidatePath("/choferes");
}

export async function deleteDriver(formData: FormData) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const id = String(formData.get("id"));

  const { error } = await supabase.from("drivers").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/choferes");
}
