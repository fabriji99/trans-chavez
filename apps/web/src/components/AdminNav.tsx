"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminNav({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav className="mt-2 flex w-full gap-1 overflow-x-auto pb-1 text-sm md:order-2 md:mt-0 md:ml-6 md:w-auto md:flex-1 md:overflow-visible md:pb-0">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`whitespace-nowrap rounded-xl px-3 py-2 transition ${
              active
                ? "bg-blue-50/70 font-bold text-blue-600"
                : "font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
