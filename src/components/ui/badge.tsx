import { cn } from "@/lib/utils";

const tones: Record<string, string> = {
  navy: "bg-primary/10 text-primary",
  teal: "bg-teal/10 text-teal",
  gray: "bg-muted text-muted-foreground",
  amber: "bg-amber-100 text-amber-900",
  red: "bg-red-100 text-red-800",
};

export function Badge({
  className,
  tone = "gray",
  ...props
}: React.ComponentProps<"span"> & { tone?: keyof typeof tones }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
