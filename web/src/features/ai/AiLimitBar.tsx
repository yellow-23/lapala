import { useEffect, useRef, useState } from "react";

export function AiLimitBar({
  remaining: remainingProp,
  limit,
  singular,
  plural,
}: {
  remaining: number | null;
  limit: number;
  singular: string;
  plural: string;
}) {
  const prevRemaining = useRef(remainingProp);
  const [justEmptied, setJustEmptied] = useState<number | null>(null);

  useEffect(() => {
    if (
      remainingProp !== null &&
      prevRemaining.current !== null &&
      remainingProp < prevRemaining.current
    ) {
      setJustEmptied(remainingProp);
      const t = setTimeout(() => setJustEmptied(null), 700);
      prevRemaining.current = remainingProp;
      return () => clearTimeout(t);
    }
    prevRemaining.current = remainingProp;
  }, [remainingProp]);

  if (remainingProp === null) return null;

  const remaining = remainingProp;
  const label = remaining === 1 ? singular : plural;
  const textColor =
    remaining === 0 ? "text-amber-400" : remaining === 1 ? "text-orange-400" : "text-gray-500";

  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-2 items-center">
        {Array.from({ length: limit }).map((_, i) => {
          const filled = i < remaining;
          const isJustEmptied = i === justEmptied;
          return (
            <span key={i} className="relative flex items-center justify-center w-3 h-3">
              {isJustEmptied && (
                <span
                  className="absolute inset-0 rounded-full bg-violet-400 opacity-0"
                  style={{ animation: "ripple 0.6s ease-out forwards" }}
                />
              )}
              <span
                className={`block rounded-full ${filled ? "w-2.5 h-2.5 bg-violet-500" : "w-2 h-2 bg-white/12"}`}
                style={{
                  transition: "transform 0.2s ease, box-shadow 0.3s ease, background-color 0.4s ease, width 0.2s ease, height 0.2s ease",
                  transform: isJustEmptied ? "scale(0.4)" : "scale(1)",
                  boxShadow: filled ? "0 0 4px rgba(139,92,246,0.3)" : "none",
                }}
              />
            </span>
          );
        })}
      </div>

      <span
        key={remaining}
        className={`text-xs tabular-nums ${textColor}`}
        style={{ animation: justEmptied !== null ? "slideDown 0.25s ease" : undefined }}
      >
        {remaining > 0
          ? `${remaining} ${label} restante${remaining !== 1 ? "s" : ""} esta hora`
          : "Limite de esta hora alcanzado"}
      </span>

      <style>{`
        @keyframes ripple {
          0%   { transform: scale(1);   opacity: 0.6; }
          100% { transform: scale(2.8); opacity: 0; }
        }
        @keyframes slideDown {
          0%   { opacity: 0; transform: translateY(-5px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

export function AiLimitBlocked({ period = "hora" }: { period?: string }) {
  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-5 text-center space-y-1">
      <p className="text-sm text-amber-300 font-medium">Limite de la {period} alcanzado</p>
      <p className="text-xs text-gray-500">
        Vuelve en unos minutos — el limite se resetea cada hora.
      </p>
    </div>
  );
}
