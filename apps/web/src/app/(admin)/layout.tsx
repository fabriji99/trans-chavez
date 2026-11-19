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
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-8">
            <span className="font-semibold text-slate-900">
              Trans. Chávez
            </span>
            <nav className="flex gap-4 text-sm text-slate-600">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="hover:text-slate-900"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-600">
            <span>{profile.full_name}</span>
            <form action={signOut}>
              <button type="submit" className="text-slate-500 hover:text-slate-900">
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
