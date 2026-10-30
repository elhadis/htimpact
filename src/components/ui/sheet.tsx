"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

export function SheetContent({
  className,
  side = "start",
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { side?: "start" | "end" }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-navy/40 md:hidden" />
      <DialogPrimitive.Content
        className={cn(
          "fixed top-0 z-50 flex h-dvh w-[min(100%,18rem)] flex-col bg-navy text-white shadow-xl md:hidden",
          side === "start" ? "start-0" : "end-0",
          className,
        )}
        {...props}
      />
    </DialogPrimitive.Portal>
  );
}
