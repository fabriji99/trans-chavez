"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../supabase/server";
import { usernameToEmail } from "@trans-chavez/shared";

export interface AuthFormState {
  error?: string;
}

export async function signIn(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { error: "Usuario y contraseña son requeridos." };
  }

  const supabase = await createSupabaseServerClient();
  // Se entra con un usuario simple; por dentro es un correo local ficticio
  const { error } = await supabase.auth.signInWithPassword({
    email: username.includes("@") ? username : usernameToEmail(username),
    password,
  });

  if (error) {
    return { error: "Credenciales inválidas." };
  }

  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
