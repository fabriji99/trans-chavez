import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "./supabase/server";
import type { Profile } from "@trans-chavez/shared";

/**
 * Sesión y perfil del usuario. Se calcula una sola vez por petición:
 * el layout y la página (y getCurrentProfile) comparten el mismo resultado
 * en vez de repetir las consultas a Supabase.
 */
const loadSession = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { authed: false as const };

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userData.user.id)
    .single();

  return {
    authed: true as const,
    profile: (profile as Profile | null) ?? null,
    error: error?.message,
  };
});

export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const session = await loadSession();
  return session.authed ? session.profile : null;
});

export async function requireAdmin(): Promise<Profile> {
  const session = await loadSession();
  if (!session.authed) redirect("/login");

  // Con sesión iniciada pero sin acceso, se explica el motivo en el login
  // (si no, el proxy y este layout se mandan el uno al otro sin fin).
  if (session.error || !session.profile) {
    console.error("requireAdmin: no se pudo leer el perfil", session.error);
    redirect("/login?error=perfil");
  }
  const p = session.profile;
  if (p.role === "cobrador") redirect("/cobrador");
  if (p.role !== "admin") redirect("/login?error=sin-acceso");
  return p;
}

/** Cobrador con sesión; un administrador que llegue aquí se manda a su panel. */
export async function requireCobrador(): Promise<Profile> {
  const session = await loadSession();
  if (!session.authed) redirect("/login");

  if (session.error || !session.profile) {
    console.error("requireCobrador: no se pudo leer el perfil", session.error);
    redirect("/login?error=perfil");
  }
  const p = session.profile;
  if (p.role === "admin") redirect("/dashboard");
  if (p.role !== "cobrador") redirect("/login?error=sin-acceso");
  return p;
}
