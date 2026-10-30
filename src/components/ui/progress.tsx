"use client";

import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/utils";

export function Progress({
  className,
  value = 0,
}: {
  className?: string;
  value?: number;
}) {
  return (
    <ProgressPrimitive.Root
      value={value}
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-secondary", className)}
    >
      <ProgressPrimitive.Indicator
        className="h-full bg-teal transition-all"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </ProgressPrimitive.Root>
  );
}
