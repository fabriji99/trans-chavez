"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "./BrandMark";

const ICONS: Record<string, string> = {
  "/dashboard": "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
  "/rutas": "M6 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM9 16h6a3 3 0 0 0 3-3V11",
  "/buses": "M5 4h14a1 1 0 0 1 1 1v11H4V5a1 1 0 0 1 1-1zM4 11h16M7 20v-4M17 20v-4",
  "/cobradores": "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  "/choferes": "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM12 4v4M4.5 14.5l3.8-1.3M19.5 14.5l-3.8-1.3",
  "/viajes": "M4 6h16M4 12h10M4 18h6",
  "/horarios": "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2",
  "/respaldos": "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
};

/** Barra lateral oscura del panel de administración (pantallas grandes). */
export function AdminSidebar({
  items,
  name,
  signOutAction,
}: {
  items: { href: string; label: string }[];
  name: string;
  signOutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-56 flex-col bg-slate-900 p-4 lg:flex">
      <div className="flex items-center gap-2.5 px-1 py-2">
        <BrandMark />
        <span className="font-display text-sm font-bold tracking-tight text-white">Trans. Chávez</span>
      </div>

      <nav className="mt-6 flex-1 space-y-1 overflow-y-auto text-sm">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition ${
                active
                  ? "bg-blue-600 font-bold text-white"
                  : "font-semibold text-white/65 hover:bg-white/10 hover:text-white"
              }`}
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={ICONS[item.href] ?? ICONS["/viajes"]} />
              </svg>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-3 rounded-2xl bg-white/10 p-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lime-400 text-sm font-extrabold text-slate-900">
          {name.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold text-white">{name}</p>
          <p className="text-[11px] text-white/60">Administrador</p>
        </div>
        <form action={signOutAction}>
          <button type="submit" className="text-xs font-bold text-white/80 hover:text-white">
            Salir
          </button>
        </form>
      </div>
    </aside>
  );
}
