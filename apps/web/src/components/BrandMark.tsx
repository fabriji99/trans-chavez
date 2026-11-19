/** Icono de la marca (tarjeta de cobro) sobre fondo azul, como en el diseño del POS. */
export function BrandMark({ size = "md" }: { size?: "md" | "lg" }) {
  const box = size === "lg" ? "h-11 w-11 rounded-2xl" : "h-8 w-8 rounded-xl";
  const icon = size === "lg" ? "h-5 w-5" : "h-4 w-4";
  return (
    <div className={`flex ${box} items-center justify-center bg-blue-600 text-white shadow-sm shadow-blue-600/25`}>
      <svg className={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="3" />
        <line x1="2" y1="10" x2="22" y2="10" />
        <circle cx="7" cy="15" r="1" fill="currentColor" />
        <line x1="12" y1="15" x2="17" y2="15" />
      </svg>
    </div>
  );
}
