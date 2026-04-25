"use client";

interface Props {
  n: number;
}

export function Countdown({ n }: Props) {
  return (
    <div className="flex min-h-[55dvh] flex-col items-center justify-center">
      <div className="text-muted-foreground mb-6 text-[11px] font-medium uppercase tracking-[0.3em]">
        Get ready
      </div>
      <div
        key={n}
        className="text-foreground animate-in zoom-in-50 fade-in font-mono text-[clamp(7rem,28vw,12rem)] font-semibold leading-none duration-300"
      >
        {n}
      </div>
      <div className="text-muted-foreground mt-8 text-sm">
        Constraints reveal at zero
      </div>
    </div>
  );
}
