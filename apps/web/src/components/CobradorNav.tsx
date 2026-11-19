"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function CobradorNav({ cobrarHref }: { cobrarHref: string }) {
  const pathname = usePathname();
  const onTrips = pathname === "/cobrador";
  const onCobrar = pathname.startsWith("/cobrador/viaje") || pathname.startsWith("/cobrador/iniciar");

  const tab = (active: boolean) =>
    `flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] transition ${
      active ? "bg-blue-50/70 font-bold text-blue-600" : "font-semibold text-slate-500 active:bg-slate-50"
    }`;

  return (
    <nav aria-label="Navegación principal" className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white px-2 pb-2 pt-1.5">
      <div className="mx-auto grid max-w-lg grid-cols-2 gap-1">
        <Link href="/cobrador" className={tab(onTrips)}>
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="6" cy="19" r="3" />
            <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
            <circle cx="18" cy="5" r="3" />
          </svg>
          Viajes
        </Link>
        <Link href={cobrarHref} className={tab(onCobrar)}>
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <line x1="2" y1="10" x2="22" y2="10" />
          </svg>
          Cobrar
        </Link>
      </div>
    </nav>
  );
}
