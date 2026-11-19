"use client";

import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn, signOut, type AuthFormState } from "@/lib/actions/auth";

const initialState: AuthFormState = {};

const URL_ERRORS: Record<string, string> = {
  perfil:
    "Iniciaste sesión, pero no se pudo leer tu perfil. Cierra la sesión e inténtalo de nuevo; si sigue igual, avisa al administrador.",
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
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-900/5">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm shadow-blue-600/25">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="5" width="20" height="14" rx="3" />
              <line x1="2" y1="10" x2="22" y2="10" />
              <circle cx="7" cy="15" r="1" fill="currentColor" />
              <line x1="12" y1="15" x2="17" y2="15" />
            </svg>
          </div>
          <div>
            <h1 className="font-display text-xl font-extrabold tracking-tight text-slate-900">Trans. Chávez</h1>
            <p className="text-sm text-slate-500">Inicia sesión</p>
          </div>
        </div>

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
            className="w-full rounded-2xl bg-blue-600 px-4 py-3.5 font-display text-base font-bold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700 active:scale-[0.99] disabled:opacity-60"
          >
            {pending ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}
