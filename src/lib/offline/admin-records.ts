"use client";
export async function invalidateDeletedRecord(entity: string, id: string) {
  try {
    const scope = localStorage.getItem("ht-active-scope");
    if (!scope || !("caches" in window)) return;
    const cache = await caches.open(`ht-impact-pages-v4-${encodeURIComponent(scope)}`);
    for (const request of await cache.keys()) {
      const pathname = new URL(request.url).pathname;
      if (["en", "ar"].some((locale) => pathname === `/${locale}/${entity}/${id}` || pathname.startsWith(`/${locale}/${entity}/${id}/`))) await cache.delete(request);
    }
  } catch { /* Cache cleanup cannot undo or retry a committed database deletion. */ }
}
