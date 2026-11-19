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
    <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
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
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-slate-900">
          Trans. Chávez
        </h1>
        <p className="mb-6 text-sm text-slate-500">
          Inicia sesión
        </p>

        <Suspense>
          <UrlError />
        </Suspense>

        <form action={action} className="space-y-4">
          <div>
            <label
              htmlFor="username"
              className="mb-1 block text-sm font-medium text-slate-700"
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
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>

          {state.error && (
            <p className="text-sm text-red-600">{state.error}</p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {pending ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}
