const STATIC_CACHE = "ht-impact-static-v4";
const PUBLIC_CACHE = "ht-impact-public-v4";
const CONTROL_CACHE = "ht-impact-control-v4";
const META = new URL("/__ht_offline_scope__", self.location.origin).href;
let activeScope = null;
let scopeChange = Promise.resolve();
const scopeByClient = new Map();
const pageCache = (scope) => `ht-impact-pages-v4-${encodeURIComponent(scope)}`;
const isLaunchPage = (url) => /^\/(en|ar)?\/?$/.test(url.pathname);
const isAppPage = (url) => /^\/(en|ar)\/(dashboard|centers|transfers|projects|beneficiaries|courses|cohorts|sessions|attendance|activities|staff|reports|audit|sync)(\/|$)/.test(url.pathname);

async function getScope(clientId) {
  await scopeChange;
  if (scopeByClient.has(clientId)) return scopeByClient.get(clientId);
  if (activeScope) return activeScope;
  const meta = await (await caches.open(CONTROL_CACHE)).match(META);
  if (!meta) return null;
  const data = await meta.json();
  if (Date.now() - data.createdAt > 30 * 24 * 60 * 60 * 1000) return null;
  activeScope = data.scope;
  return activeScope;
}
async function clearScope() {
  activeScope = null; scopeByClient.clear();
  const keys = await caches.keys();
  await Promise.all(keys.filter((key) => key.startsWith("ht-impact-pages-") || key === CONTROL_CACHE).map((key) => caches.delete(key)));
}
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(PUBLIC_CACHE).then((cache) => cache.addAll(["/offline.html", "/manifest.webmanifest", "/icons/icon-192.png"])));
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("ht-impact-") && ![STATIC_CACHE, PUBLIC_CACHE, CONTROL_CACHE].includes(key) && !key.startsWith("ht-impact-pages-v4-")).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("message", (event) => {
  if (event.data?.type === "CLEAR_SCOPE") {
    scopeChange = scopeChange.then(() => clearScope());
    event.waitUntil(scopeChange);
  }
  if (event.data?.type === "SET_SCOPE" && typeof event.data.scope === "string") {
    const scope = event.data.scope;
    scopeChange = scopeChange.then(async () => {
      if (activeScope && activeScope !== scope) await clearScope();
      activeScope = scope;
      if (event.source?.id) scopeByClient.set(event.source.id, scope);
      await (await caches.open(CONTROL_CACHE)).put(META, new Response(JSON.stringify({ scope, createdAt: Date.now() })));
    });
    event.waitUntil(scopeChange);
  }
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/auth/signout") || url.pathname.startsWith("/api/auth/callback")) {
    scopeChange = scopeChange.then(() => clearScope());
    event.waitUntil(scopeChange); return;
  }
  if (request.method !== "GET" || url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith((async () => {
      const cache = await caches.open(STATIC_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    })()); return;
  }
  if (request.headers.has("RSC") || url.searchParams.has("_rsc") || url.pathname.startsWith("/_next/")) return;
  // Installed copies can still launch at /en (or /). These entry routes
  // normally need a server redirect, so resolve them locally when offline.
  if (isLaunchPage(url) && request.mode === "navigate") {
    event.respondWith((async () => {
      try { return await fetch(request); }
      catch {
        const scope = await getScope(event.clientId);
        if (scope) {
          const locale = url.pathname.match(/^\/(en|ar)(?:\/|$)/)?.[1] || "en";
          const dashboard = new URL(`/${locale}/dashboard`, self.location.origin).href;
          const cache = await caches.open(pageCache(scope));
          if (await cache.match(dashboard)) {
            if (event.resultingClientId) scopeByClient.set(event.resultingClientId, scope);
            return Response.redirect(dashboard, 302);
          }
        }
        return await caches.match("/offline.html") || Response.error();
      }
    })());
    return;
  }
  if (isAppPage(url) && (request.mode === "navigate" || request.headers.has("X-HT-Offline-Scope"))) {
    event.respondWith((async () => {
      const scope = request.headers.get("X-HT-Offline-Scope") || await getScope(event.clientId);
      const cache = scope ? await caches.open(pageCache(scope)) : null;
      const key = new Request(url.href);
      try {
        const response = await fetch(request);
        const finalUrl = new URL(response.url || request.url);
        if (response.ok && !response.redirected && isAppPage(finalUrl) && response.headers.get("content-type")?.includes("text/html")) {
          if (cache) await cache.put(key, response.clone());
        } else if (response.redirected && /\/login/.test(finalUrl.pathname)) await clearScope();
        if (scope && event.resultingClientId) scopeByClient.set(event.resultingClientId, scope);
        return response;
      } catch {
        return (cache && await cache.match(key)) || await caches.match("/offline.html") || Response.error();
      }
    })()); return;
  }
  if (["/manifest.webmanifest", "/offline.html"].includes(url.pathname) || url.pathname.startsWith("/icons/")) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
  }
});
