import { requireCobrador } from "@/lib/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";
import { BrandMark } from "@/components/BrandMark";
import { CobradorNav } from "@/components/CobradorNav";

export default async function CobradorLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireCobrador();
  const supabase = await createSupabaseServerClient();

  // "Cobrar" lleva al viaje en curso, o a iniciar uno si no hay
  const { data: open } = await supabase
    .from("trips")
    .select("id")
    .eq("cobrador_id", profile.id)
    .eq("status", "in_progress")
    .limit(1);
  const cobrarHref = open && open.length > 0 ? `/cobrador/viaje/${open[0].id}` : "/cobrador/iniciar";

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <BrandMark />
            <span className="font-display text-sm font-bold tracking-tight text-slate-900">Trans. Chávez</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="max-w-[9rem] truncate rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-800">
              {profile.full_name}
              {profile.code ? ` · ${profile.code}` : ""}
            </span>
            <form action={signOut}>
              <button type="submit" className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:text-blue-600">
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-4">{children}</main>
      <CobradorNav cobrarHref={cobrarHref} />
    </div>
  );
}
