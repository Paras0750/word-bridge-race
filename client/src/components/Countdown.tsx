"use client";

interface Props {
  n: number;
}

export function Countdown({ n }: Props) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center">
      <div className="label mb-4">Get ready</div>
      <div
        key={n}
        className="text-[10rem] font-bold leading-none text-accent drop-shadow-[0_0_30px_rgba(124,92,255,0.5)] animate-pulse"
      >
        {n}
      </div>
      <div className="mt-6 text-sm text-muted">Constraints reveal at zero.</div>
    </div>
  );
}
