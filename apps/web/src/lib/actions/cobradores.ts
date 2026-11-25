"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "../supabase/admin";
import { requireAdmin } from "../dal";
import { usernameSchema, usernameToEmail } from "@trans-chavez/shared";

export async function createCobrador(formData: FormData) {
  await requireAdmin();

  const username = usernameSchema.safeParse(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();

  if (!fullName || !password) {
    throw new Error("Nombre y contraseña son requeridos.");
  }
  if (!username.success) throw new Error(username.error.issues[0].message);
  if (password.length < 8) {
    throw new Error("La contraseña debe tener al menos 8 caracteres.");
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email: usernameToEmail(username.data),
    password,
    email_confirm: true,
    // El rol va en app_metadata: solo el servidor puede escribirlo
    app_metadata: { role: "cobrador" },
    user_metadata: { full_name: fullName },
  });
  if (error) {
    throw new Error(
      error.message.includes("already been registered")
        ? "Ya existe un cobrador con ese usuario."
        : error.message,
    );
  }

  revalidatePath("/viajes");
  revalidatePath("/cobradores");
}

export async function updateCobrador(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const username = usernameSchema.safeParse(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const active = formData.get("active") === "on";

  if (!id || !fullName) throw new Error("El nombre es requerido.");
  if (!username.success) throw new Error(username.error.issues[0].message);
  if (password && password.length < 8) {
    throw new Error("La contraseña debe tener al menos 8 caracteres.");
  }

  const admin = createSupabaseAdminClient();

  // Solo se editan cuentas de cobrador desde esta pantalla
  const { data: target } = await admin.from("profiles").select("role").eq("id", id).single();
  if (target?.role !== "cobrador") throw new Error("Esta cuenta no es de un cobrador.");

  const { error: profileError } = await admin
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", id);
  if (profileError) throw new Error(profileError.message);

  const { error } = await admin.auth.admin.updateUserById(id, {
    email: usernameToEmail(username.data),
    email_confirm: true,
    ...(password ? { password } : {}),
    // Desactivar bloquea el inicio de sesión sin borrar sus viajes ni boletos
    ban_duration: active ? "none" : "876000h",
    user_metadata: { full_name: fullName },
  });
  if (error) {
    throw new Error(
      error.message.includes("already been registered")
        ? "Ya existe un cobrador con ese usuario."
        : error.message,
    );
  }

  revalidatePath("/cobradores");
  revalidatePath("/viajes");
  redirect("/cobradores");
}
