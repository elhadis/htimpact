"use client";
import { useEffect, useState } from "react";
import { usePathname } from "@/i18n/navigation";
import { setOfflineScope } from "@/lib/offline/db";

export async function clearOfflinePages() {
  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("ht-impact-pages-")).map((key) => caches.delete(key)));
  }
  navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_SCOPE" });
  localStorage.removeItem("ht-active-scope");
  setOfflineScope("unassigned");
}

export function OfflineBoundary({ scope, locale, children }: { scope: string; locale: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    async function initialize() {
      if (localStorage.getItem("ht-active-scope") !== scope) await clearOfflinePages();
      localStorage.setItem("ht-active-scope", scope);
      setOfflineScope(scope);
      if (alive) setReady(true);
      if (!("serviceWorker" in navigator)) return;
      const registration = await navigator.serviceWorker.ready;
      const worker = navigator.serviceWorker.controller ?? registration.active;
      worker?.postMessage({ type: "SET_SCOPE", scope });
      // Fetch a complete document, never a partial RSC response, for offline reloads.
      // Both language versions are prepared after an authenticated online visit.
      if (navigator.onLine) {
        await fetch(window.location.href, { headers: { "X-HT-Offline-Scope": scope }, cache: "no-store" }).catch(() => undefined);
      }
    }
    void initialize();
    const onOnline = () => { void initialize(); };
    window.addEventListener("online", onOnline);
    const offlineNavigation = (event: MouseEvent) => {
      if (navigator.onLine || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const target = (event.target as Element)?.closest("a");
      if (!target || target.target === "_blank" || target.hasAttribute("download")) return;
      const url = new URL(target.href, location.href);
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return;
      event.preventDefault(); event.stopPropagation(); location.assign(url.href);
    };
    document.addEventListener("click", offlineNavigation, true);
    return () => { alive = false; window.removeEventListener("online", onOnline); document.removeEventListener("click", offlineNavigation, true); };
  }, [scope, locale, pathname]);
  return ready ? children : <div className="min-h-dvh bg-background" aria-busy="true" />;
}
