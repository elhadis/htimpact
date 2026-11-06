const STATIC_CACHE = "ht-impact-static-v4";
const PUBLIC_CACHE = "ht-impact-public-v4";
const CONTROL_CACHE = "ht-impact-control-v4";
const META = new URL("/__ht_offline_scope__", self.location.origin).href;
let activeScope = null;
let scopeChange = Promise.resolve();
let preparation = null;
let preparationScope = null;
let preparedAt = 0;
let preparedBuild = null;
const scopeByClient = new Map();
const pageCache = (scope) => `ht-impact-pages-v4-${encodeURIComponent(scope)}`;
const isLaunchPage = (url) => /^\/(en|ar)?\/?$/.test(url.pathname);
const isAppPage = (url) => /^\/(en|ar)\/(dashboard|quality|centers|transfers|projects|beneficiaries|courses|cohorts|sessions|attendance|activities|staff|reports|audit|sync)(\/|$)/.test(url.pathname);
function pageKey(input) {
  const url = new URL(typeof input === "string" ? input : input.url, self.location.origin);
  url.hash = "";
  url.searchParams.delete("_rsc");
  url.searchParams.sort();
  return url.href;
}
async function network(request) {
  return fetch(request, { signal: AbortSignal.timeout(12000) });
}
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
  activeScope = null; scopeByClient.clear(); preparedAt = 0;
  const keys = await caches.keys();
  await Promise.all(keys.filter((key) => key.startsWith("ht-impact-pages-") || key === CONTROL_CACHE).map((key) => caches.delete(key)));
}
async function notify(scope, progress) {
  for (const client of await self.clients.matchAll({ type: "window", includeUncontrolled: true })) {
    if (scopeByClient.get(client.id) === scope) client.postMessage({ type: "OFFLINE_PREPARATION", scope, ...progress });
  }
}
async function prepareSnapshots(scope, force = false, locale = "en") {
  if (preparation && preparationScope === scope) {
    if (force) return preparation.then(() => prepareSnapshots(scope, true, locale));
    return preparation;
  }
  if (!force && preparedAt && Date.now() - preparedAt < 60000 && activeScope === scope) {
    await notify(scope, { stage: "ready", completed: 1, total: 1, failed: 0 });
    return;
  }
  preparationScope = scope;
  const work = (async () => {
    try {
      const [routeResponse, assetResponse] = await Promise.all([
        network(new Request(new URL("/api/offline/routes", self.location.origin), { credentials: "include", cache: "no-store" })),
        network(new Request(new URL("/offline-assets.json", self.location.origin), { cache: "no-store" })),
      ]);
      if (!routeResponse.ok || !assetResponse.ok) throw new Error("Offline index unavailable");
      const index = await routeResponse.json();
      const manifest = await assetResponse.json();
      if (index.scope !== scope || activeScope !== scope || !Array.isArray(index.paths) || !Array.isArray(manifest.assets)) return;
      const staticCache = await caches.open(STATIC_CACHE);
      let failed = 0;
      let completed = 0;
      const assets = manifest.assets.filter((asset) => typeof asset === "string" && asset.startsWith("/_next/static/"));
      // Both languages and every authorized record are indexed by the server,
      // including rows not rendered on the first page of a paginated table.
      const pages = [locale, locale === "ar" ? "en" : "ar"].flatMap((language) => index.paths.map((path) => `/${language}${path}`));
      const total = assets.length + pages.length;
      await notify(scope, { stage: "preparing", completed, total, failed });
      async function batch(items, count, save) {
        let position = 0;
        await Promise.all(Array.from({ length: count }, async () => {
          while (position < items.length && activeScope === scope) {
            const item = items[position++];
            try { await save(item); } catch { failed++; }
            completed++;
            if (completed % 5 === 0 || completed === total) await notify(scope, { stage: "preparing", completed, total, failed });
          }
        }));
      }
      await batch(assets, 4, async (asset) => {
        if (await staticCache.match(asset)) return;
        const response = await network(new Request(new URL(asset, self.location.origin)));
        if (!response.ok) throw new Error("Asset unavailable");
        await staticCache.put(asset, response);
      });
      const cache = await caches.open(pageCache(scope));
      await batch(pages, 2, async (path) => {
        const url = new URL(path, self.location.origin);
        if (!isAppPage(url)) return;
        const response = await network(new Request(url, { credentials: "include", cache: "no-store", headers: { "X-HT-Offline-Scope": scope } }));
        if (!response.ok || response.redirected || !response.headers.get("content-type")?.includes("text/html")) throw new Error("Page unavailable");
        if (activeScope !== scope) return;
        await cache.put(pageKey(url.href), response);
      });
      if (activeScope !== scope) return;
      preparedAt = failed ? 0 : Date.now();
      preparedBuild = manifest.buildId;
      await notify(scope, { stage: failed ? "incomplete" : "ready", completed, total, failed });
    } catch {
      if (activeScope === scope) await notify(scope, { stage: "incomplete", completed: 0, total: 0, failed: 1 });
    }
  })();
  preparation = work;
  try { await work; } finally { if (preparation === work) preparation = null; }
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
      event.ports?.[0]?.postMessage({ ready: true, buildId: preparedBuild });
    });
    event.waitUntil(scopeChange);
  }
  if (event.data?.type === "PREPARE_PAGES" && typeof event.data.scope === "string") {
    const { scope, force, locale } = event.data;
    event.waitUntil(scopeChange.then(async () => {
      if (scopeByClient.get(event.source?.id) === scope && activeScope === scope) await prepareSnapshots(scope, Boolean(force), locale === "ar" ? "ar" : "en");
    }));
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
      const response = await network(request);
      if (response.ok) await cache.put(request, response.clone()).catch(() => undefined);
      return response;
    })()); return;
  }
  const flight = request.headers.has("RSC") || url.searchParams.has("_rsc");
  if (flight && isAppPage(url)) {
    // Never replay Flight payloads from a different router state. Next.js falls
    // back to document navigation for a cached HTML response (same scoped URL).
    event.respondWith((async () => {
      try { return await network(request); }
      catch {
        const scope = await getScope(event.clientId);
        const cache = scope ? await caches.open(pageCache(scope)) : null;
        return (cache && await cache.match(pageKey(url.href))) || await caches.match("/offline.html") || Response.error();
      }
    })()); return;
  }
  if (url.pathname.startsWith("/_next/")) return;
  if (isLaunchPage(url) && request.mode === "navigate") {
    event.respondWith((async () => {
      try { return await network(request); }
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
    })()); return;
  }
  if (isAppPage(url) && (request.mode === "navigate" || request.headers.has("X-HT-Offline-Scope"))) {
    event.respondWith((async () => {
      const scope = await getScope(event.clientId);
      const cache = scope ? await caches.open(pageCache(scope)) : null;
      try {
        const response = await network(request);
        const finalUrl = new URL(response.url || request.url);
        if (cache && response.ok && !response.redirected && isAppPage(finalUrl) && response.headers.get("content-type")?.includes("text/html") && activeScope === scope) {
          await cache.put(pageKey(url.href), response.clone()).catch(() => undefined);
        } else if (response.redirected && /\/login/.test(finalUrl.pathname)) await clearScope();
        if (scope && event.resultingClientId) scopeByClient.set(event.resultingClientId, scope);
        return response;
      } catch {
        return (cache && await cache.match(pageKey(url.href))) || await caches.match("/offline.html") || Response.error();
      }
    })()); return;
  }
  if (["/manifest.webmanifest", "/offline.html"].includes(url.pathname) || url.pathname.startsWith("/icons/")) {
    event.respondWith(caches.match(request).then((cached) => cached || network(request)));
  }
});
