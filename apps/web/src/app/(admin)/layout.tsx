import Link from "next/link";
import { requireAdmin } from "@/lib/dal";
import { signOut } from "@/lib/actions/auth";

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
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 px-4 py-3 sm:px-6 md:py-4">
          <span className="font-semibold text-slate-900">Trans. Chávez</span>

          <div className="flex items-center gap-3 text-sm text-slate-600 md:order-3 md:gap-4">
            <span className="max-w-[9rem] truncate md:max-w-none">{profile.full_name}</span>
            <form action={signOut}>
              <button type="submit" className="text-slate-500 hover:text-slate-900">
                Salir
              </button>
            </form>
          </div>

          {/* En teléfono el menú ocupa su propia fila y se desliza de lado */}
          <nav className="mt-2 flex w-full gap-1 overflow-x-auto pb-1 text-sm text-slate-600 md:order-2 md:mt-0 md:ml-8 md:w-auto md:flex-1 md:gap-4 md:overflow-visible md:pb-0">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap rounded-md px-3 py-2 hover:bg-slate-100 hover:text-slate-900 md:p-0 md:hover:bg-transparent"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
