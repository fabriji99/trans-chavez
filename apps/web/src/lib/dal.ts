import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "./supabase/server";
import type { Profile } from "@trans-chavez/shared";

export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userData.user.id)
    .single();

  return (profile as Profile) ?? null;
});

export async function requireAdmin(): Promise<Profile> {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userData.user.id)
    .single();

  // Con sesión iniciada pero sin acceso, se explica el motivo en el login
  // (si no, el proxy y este layout se mandan el uno al otro sin fin).
  if (error || !profile) {
    console.error("requireAdmin: no se pudo leer el perfil", error?.message);
    redirect("/login?error=perfil");
  }
  if ((profile as Profile).role !== "admin") redirect("/login?error=sin-acceso");
  return profile as Profile;
}
