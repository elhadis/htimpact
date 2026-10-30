import * as React from "react";
import { cn } from "@/lib/utils";

export const fieldClass =
  "flex h-11 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground shadow-sm outline-none transition placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(fieldClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(fieldClass, "min-h-28 resize-y py-2", className)}
      {...props}
    />
  );
}

export function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return <select className={cn(fieldClass, "bg-card", className)} {...props} />;
}
