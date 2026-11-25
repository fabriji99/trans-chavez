"use client";

import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn, signOut, type AuthFormState } from "@/lib/actions/auth";

const initialState: AuthFormState = {};

const URL_ERRORS: Record<string, string> = {
  perfil:
    "Iniciaste sesión, pero no se pudo leer tu perfil. Cierra la sesión e inténtalo de nuevo; si sigue igual, avisa al administrador.",
  sesion:
    "Tu sesión se cerró: se abrió en otro dispositivo o venció. Inicia sesión de nuevo.",
  "sin-acceso":
    "Esta cuenta no tiene acceso. Avisa al administrador.",
};

function UrlError() {
  const code = useSearchParams().get("error");
  if (!code) return null;
  return (
    <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
      <p>{URL_ERRORS[code] ?? "No se pudo abrir el panel."}</p>
      <form action={signOut} className="mt-2">
        <button type="submit" className="font-medium underline">
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  const [state, action, pending] = useActionState(signIn, initialState);

  return (
    <div className="flex min-h-screen flex-col bg-canvas sm:items-center sm:justify-center sm:px-4">
      <div className="w-full sm:max-w-sm">
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 to-blue-700 px-7 pb-24 pt-16 text-white sm:rounded-t-3xl sm:pt-10">
          <div className="absolute -right-14 -top-14 h-56 w-56 rounded-full bg-white/10" />
          <div className="absolute -bottom-16 right-10 h-36 w-36 rounded-full bg-white/5" />
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-lg shadow-black/10">
            <svg className="h-7 w-7 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="5" width="20" height="14" rx="3" />
              <line x1="2" y1="10" x2="22" y2="10" />
              <circle cx="7" cy="15" r="1" fill="currentColor" />
              <line x1="12" y1="15" x2="17" y2="15" />
            </svg>
          </div>
          <h1 className="relative mt-5 font-display text-3xl font-extrabold tracking-tight">Trans. Chávez</h1>
          <p className="relative mt-1 text-sm text-white/85">Cobro de pasajes y control de viajes</p>
        </div>

        <div className="-mt-14 mx-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/10 sm:mx-0 sm:mt-0 sm:rounded-t-none sm:border-t-0">
          <h2 className="font-display text-xl font-extrabold tracking-tight text-slate-900">Iniciar sesión</h2>
          <p className="mb-5 mt-1 text-sm text-slate-500">Entra con tu usuario y contraseña</p>

        <Suspense>
          <UrlError />
        </Suspense>

        <form action={action} className="space-y-4">
          <div>
            <label
              htmlFor="username"
              className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500"
            >
              Usuario
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoCapitalize="none"
              autoComplete="username"
              required
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500"
            >
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />
          </div>

          {state.error && (
            <p className="text-sm text-red-600">{state.error}</p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-2xl bg-blue-600 px-4 py-4 font-display text-base font-bold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700 active:scale-[0.99] disabled:opacity-60"
          >
            {pending ? "Ingresando..." : "Ingresar"}
          </button>
        </form>

        <p className="mt-5 rounded-2xl bg-blue-50 px-3.5 py-3 text-[13px] leading-snug text-blue-700">
          Administradores y cobradores usan la misma pantalla. Te llevamos a tu panel automáticamente.
        </p>
        </div>
        <p className="py-6 text-center text-xs text-slate-500">¿Olvidaste tu contraseña? Pídesela al administrador.</p>
      </div>
    </div>
  );
}
