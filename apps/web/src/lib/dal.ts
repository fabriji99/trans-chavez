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
  const p = profile as Profile;
  if (p.role === "cobrador") redirect("/cobrador");
  if (p.role !== "admin") redirect("/login?error=sin-acceso");
  return p;
}

/** Cobrador con sesión; un administrador que llegue aquí se manda a su panel. */
export async function requireCobrador(): Promise<Profile> {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userData.user.id)
    .single();

  if (error || !profile) {
    console.error("requireCobrador: no se pudo leer el perfil", error?.message);
    redirect("/login?error=perfil");
  }
  const p = profile as Profile;
  if (p.role === "admin") redirect("/dashboard");
  if (p.role !== "cobrador") redirect("/login?error=sin-acceso");
  return p;
}
