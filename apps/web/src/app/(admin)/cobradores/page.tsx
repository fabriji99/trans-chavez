import { createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import { createCobrador } from "@/lib/actions/cobradores";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { emailToUsername } from "@trans-chavez/shared";
import type { Profile } from "@trans-chavez/shared";

export default async function CobradoresPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "cobrador")
    .order("full_name");
  const cobradores = (data as Profile[]) ?? [];

  // El usuario de cada cobrador es la parte local de su correo en Supabase Auth
  const { data: authData } = await createSupabaseAdminClient().auth.admin.listUsers({ perPage: 1000 });
  const usernameById = new Map(
    (authData?.users ?? []).map((u) => [u.id, emailToUsername(u.email ?? "")]),
  );
  const disabledIds = new Set(
    (authData?.users ?? [])
      .filter((u) => u.banned_until && new Date(u.banned_until) > new Date())
      .map((u) => u.id),
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Cobradores</h1>
        <p className="text-sm text-slate-500">
          Cuentas que usan la app móvil para vender boletos.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="mb-3 text-sm font-medium text-slate-700">
          Registrar cobrador
        </h2>
        <form
          action={createCobrador}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          <input
            name="full_name"
            placeholder="Nombre completo"
            required
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            name="username"
            placeholder="Usuario (ej. selvin)"
            required
            minLength={3}
            maxLength={30}
            pattern="[A-Za-z0-9._\-]+"
            autoCapitalize="none"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            name="password"
            type="password"
            placeholder="Contraseña temporal (mín. 8 caracteres)"
            required
            minLength={8}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="col-span-1 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 sm:col-span-2 sm:w-fit"
          >
            Crear cuenta
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="overflow-x-auto">
<table className="w-full min-w-max text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2">Nombre</th>
              <th className="py-2">Usuario</th>
              <th className="py-2">Estado</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {cobradores.map((c) => (
              <tr key={c.id} className="border-b border-slate-100">
                <td className="py-2 text-slate-900">{c.full_name}</td>
                <td className="py-2 text-slate-600">{usernameById.get(c.id) ?? "—"}</td>
                <td className="py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      disabledIds.has(c.id)
                        ? "bg-slate-200 text-slate-600"
                        : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {disabledIds.has(c.id) ? "Desactivado" : "Activo"}
                  </span>
                </td>
                <td className="py-2 text-right">
                  <Link
                    href={`/cobradores/${c.id}`}
                    className="rounded-md border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
            {cobradores.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-center text-slate-400">
                  Aún no hay cobradores registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
</div>
      </section>
    </div>
  );
}
