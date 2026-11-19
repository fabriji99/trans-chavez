import Link from "next/link";
import { requireCobrador } from "@/lib/dal";
import { signOut } from "@/lib/actions/auth";

export default async function CobradorLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireCobrador();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-3">
          <Link href="/cobrador" className="font-semibold text-slate-900">
            Trans. Chávez
          </Link>
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span className="max-w-[9rem] truncate">
              {profile.full_name}
              {profile.code ? ` · ${profile.code}` : ""}
            </span>
            <form action={signOut}>
              <button type="submit" className="text-slate-500 hover:text-slate-900">
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-5">{children}</main>
    </div>
  );
}
