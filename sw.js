// Service worker do CaloriQuest.
//
// Estratégia "stale-while-revalidate": responde do cache (rápido e funciona
// offline) e, em paralelo, busca a versão nova na rede e guarda para a próxima
// vez. Assim uma troca de sprite ou de código chega ao aparelho sozinha, sem
// depender de eu lembrar de mudar a versão do cache.
const CACHE = "caloriquest-v8";
const ASSETS = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/foods.js",
  "./js/calc.js",
  "./js/challenges.js",
  "./js/fasting.js",
  "./js/gym.js",
  "./js/mascots.js",
  "./js/game.js",
  "./js/sync.js",
  "./js/app.js",
  "./manifest.webmanifest",
  "./assets/sprites/walker_m.png",
  "./assets/sprites/walker_f.png",
  "./assets/sprites/char_m.png",
  "./assets/sprites/char_f.png",
  "./assets/sprites/dog.png",
  "./assets/sprites/cat.png",
  "./assets/sprites/mascot_dog.png",
  "./assets/sprites/mascot_cat.png",
  "./assets/sprites/ground.png",
  "./assets/sprites/hills.png",
  "./assets/sprites/cloud1.png",
  "./assets/sprites/cloud2.png",
  "./assets/sprites/sun.png",
  "./assets/sprites/storm.png",
  "./assets/sprites/icon-192.png",
  "./assets/sprites/icon-512.png",
];

self.addEventListener("install", (e) => {
  // reload: true ignora o cache HTTP do navegador ao montar o cache novo
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      c.addAll(ASSETS.map((u) => new Request(u, { cache: "reload" })))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes("/api/")) return; // API sempre pela rede

  // A busca na rede começa já e é registrada com waitUntil: sem isso o
  // navegador pode encerrar o service worker assim que a resposta do cache
  // sai, e a versão nova nunca chega a ser gravada — foi exatamente o que
  // deixou aparelhos presos no sprite antigo.
  const fromNetwork = fetch(req, { cache: "no-cache" })
    .then(async (res) => {
      if (res && res.ok) {
        const cache = await caches.open(CACHE);
        await cache.put(req, res.clone());
      }
      return res;
    })
    .catch(() => null);
  e.waitUntil(fromNetwork);

  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(
      (cached) => cached || fromNetwork.then((res) => res || Response.error())
    )
  );
});
