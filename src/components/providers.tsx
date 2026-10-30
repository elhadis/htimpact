"use client";

import { useEffect } from "react";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ locale, children }: { locale: string; children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  return (
    <SessionProvider>
      <TooltipProvider>
        <div
          lang={locale}
          dir={locale === "ar" ? "rtl" : "ltr"}
          className={locale === "ar" ? "font-locale-ar min-h-dvh" : "font-locale-en min-h-dvh"}
        >
          {children}
        </div>
        <Toaster richColors closeButton position="top-center" />
      </TooltipProvider>
    </SessionProvider>
  );
}
