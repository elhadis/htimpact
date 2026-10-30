"use client";

import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;

export function SelectTrigger({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        "flex h-11 w-full items-center justify-between rounded-lg border border-input bg-card px-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.Value />
      <ChevronDown className="size-4 text-muted-foreground" />
    </SelectPrimitive.Trigger>
  );
}

export function SelectContent({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        position="popper"
        className={cn(
          "z-50 max-h-80 w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border bg-card shadow-lg",
          className,
        )}
        {...props}
      >
        <SelectPrimitive.Viewport className="p-1">{props.children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={cn(
        "relative flex cursor-pointer items-center rounded-md py-2 ps-8 pe-3 text-sm outline-none focus:bg-accent data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemIndicator className="absolute start-2">
        <Check className="size-4 text-teal" />
      </SelectPrimitive.ItemIndicator>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}
