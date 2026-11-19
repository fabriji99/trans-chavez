import { requireAdmin } from "@/lib/dal";
import { signOut } from "@/lib/actions/auth";
import { BrandMark } from "@/components/BrandMark";
import { AdminNav } from "@/components/AdminNav";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/rutas", label: "Rutas y paradas" },
  { href: "/buses", label: "Buses" },
  { href: "/cobradores", label: "Cobradores" },
  { href: "/choferes", label: "Choferes" },
  { href: "/viajes", label: "Viajes" },
  { href: "/horarios", label: "Horarios" },
  { href: "/respaldos", label: "Respaldos" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireAdmin();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <BrandMark />
            <span className="font-display text-sm font-bold tracking-tight text-slate-900">Trans. Chávez</span>
          </div>

          <div className="flex items-center gap-2 text-sm md:order-3">
            <span className="max-w-[9rem] truncate rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-800 md:max-w-none">
              {profile.full_name}
            </span>
            <form action={signOut}>
              <button type="submit" className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:text-blue-600">
                Salir
              </button>
            </form>
          </div>

          {/* En teléfono el menú ocupa su propia fila y se desliza de lado */}
          <AdminNav items={NAV_ITEMS} />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
