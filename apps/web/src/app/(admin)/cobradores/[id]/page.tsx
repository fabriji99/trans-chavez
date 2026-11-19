import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { updateCobrador } from "@/lib/actions/cobradores";
import { emailToUsername } from "@trans-chavez/shared";
import type { Profile } from "@trans-chavez/shared";

const inputClass = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm";

export default async function EditarCobradorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  const cobrador = data as Profile | null;
  if (!cobrador || cobrador.role !== "cobrador") notFound();

  const { data: authData } = await createSupabaseAdminClient().auth.admin.getUserById(id);
  const user = authData?.user;
  const username = emailToUsername(user?.email ?? "");
  const disabled = !!user?.banned_until && new Date(user.banned_until) > new Date();

  return (
    <div className="space-y-8">
      <div>
        <Link href="/cobradores" className="text-sm text-slate-500 hover:underline">
          ‹ Cobradores
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-slate-900">Editar cobrador</h1>
        <p className="text-sm text-slate-500">
          Código {cobrador.code ?? "—"} · Los viajes y boletos anteriores se conservan.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <form action={updateCobrador} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <input type="hidden" name="id" value={cobrador.id} />
          <label className="space-y-1 text-xs text-slate-500">
            Nombre completo
            <input name="full_name" defaultValue={cobrador.full_name} required className={inputClass} />
          </label>
          <label className="space-y-1 text-xs text-slate-500">
            Usuario
            <input
              name="username"
              defaultValue={username}
              required
              minLength={3}
              maxLength={30}
              pattern="[A-Za-z0-9._\-]+"
              autoCapitalize="none"
              className={inputClass}
            />
          </label>
          <label className="space-y-1 text-xs text-slate-500">
            Nueva contraseña (déjala vacía para no cambiarla)
            <input
              name="password"
              type="password"
              minLength={8}
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
              className={inputClass}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
            <input type="checkbox" name="active" defaultChecked={!disabled} />
            Cuenta activa (si la desactivas, no podrá iniciar sesión en la app)
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Guardar cambios
            </button>
            <Link
              href="/cobradores"
              className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </Link>
          </div>
        </form>
      </section>
    </div>
  );
}
