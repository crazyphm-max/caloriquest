// Service worker: deixa o CaloriQuest funcionar offline (cache-first)
const CACHE = "caloriquest-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/foods.js",
  "./js/calc.js",
  "./js/challenges.js",
  "./js/game.js",
  "./js/app.js",
  "./manifest.webmanifest",
  "./assets/sprites/walker.png",
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
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request))
  );
});
