"use client";

/** Opción grande para tocar con el dedo; la elegida se marca con borde azul. */
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
      className={`min-h-[44px] rounded-xl px-4 py-2 text-sm transition ${
        active
          ? "border-2 border-blue-600 bg-blue-50/70 font-bold text-blue-600"
          : "border border-slate-200 bg-white font-medium text-slate-700 active:bg-slate-50"
      } ${disabled ? "opacity-40" : ""}`}
    >
      {label}
    </button>
  );
}
