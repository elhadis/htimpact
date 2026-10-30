"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ inverted = false }: { inverted?: boolean }) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div
      className={cn(
        "inline-flex rounded-lg p-0.5 text-sm",
        inverted ? "bg-white/10" : "border bg-card",
      )}
      role="group"
      aria-label="Language"
    >
      {(["en", "ar"] as const).map((item) => (
        <button
          key={item}
          type="button"
          className={cn(
            "rounded-md px-2.5 py-1 font-medium",
            locale === item
              ? inverted
                ? "bg-white text-primary"
                : "bg-primary text-primary-foreground"
              : inverted
                ? "text-white/80"
                : "text-muted-foreground",
          )}
          onClick={() => router.replace(pathname, { locale: item })}
        >
          {item === "en" ? "EN" : "عربي"}
        </button>
      ))}
    </div>
  );
}
