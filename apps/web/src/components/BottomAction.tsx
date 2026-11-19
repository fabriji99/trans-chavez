/** Barra fija con la acción principal, justo encima de la navegación inferior. */
export function BottomAction({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-[68px] z-20 border-t border-slate-200 bg-white px-4 py-3">
      <div className="mx-auto max-w-lg">{children}</div>
    </div>
  );
}
