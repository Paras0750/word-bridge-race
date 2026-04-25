"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SliderProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  onValueChange?: (value: number) => void;
  onValueCommitted?: (value: number) => void;
}

function Slider({
  className,
  value,
  min,
  max,
  step = 1,
  disabled,
  onValueChange,
  onValueCommitted,
  ...props
}: SliderProps) {
  const range = max - min || 1;
  const pct = ((value - min) / range) * 100;

  return (
    <div className={cn("relative flex h-5 w-full items-center", className)}>
      <div className="bg-secondary pointer-events-none absolute inset-x-0 h-1 rounded-full" />
      <div
        className="bg-foreground pointer-events-none absolute left-0 h-1 rounded-full"
        style={{ width: `${pct}%` }}
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const next = Number(e.target.value);
          if (!Number.isNaN(next)) onValueChange?.(next);
        }}
        onMouseUp={(e) => {
          const next = Number((e.target as HTMLInputElement).value);
          if (!Number.isNaN(next)) onValueCommitted?.(next);
        }}
        onTouchEnd={(e) => {
          const next = Number((e.target as HTMLInputElement).value);
          if (!Number.isNaN(next)) onValueCommitted?.(next);
        }}
        onKeyUp={(e) => {
          const next = Number((e.target as HTMLInputElement).value);
          if (!Number.isNaN(next)) onValueCommitted?.(next);
        }}
        className={cn(
          "relative z-10 h-5 w-full cursor-pointer appearance-none bg-transparent",
          "[&::-webkit-slider-runnable-track]:h-5 [&::-webkit-slider-runnable-track]:bg-transparent",
          "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background [&::-webkit-slider-thumb]:shadow-md",
          "[&::-moz-range-track]:h-5 [&::-moz-range-track]:bg-transparent [&::-moz-range-track]:border-0",
          "[&::-moz-range-thumb]:size-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-foreground [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-background [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:cursor-pointer",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
        {...props}
      />
    </div>
  );
}

export { Slider };
