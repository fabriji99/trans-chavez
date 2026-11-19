"use client";

/** Botón de opción grande para tocar con el dedo (como las "fichas" de la app móvil). */
export function Chip({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-full border px-4 py-2.5 text-sm transition ${
        active
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-300 bg-white text-slate-700 active:bg-slate-100"
      } ${disabled ? "opacity-40" : ""}`}
    >
      {label}
    </button>
  );
}
