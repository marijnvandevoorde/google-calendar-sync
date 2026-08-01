"use strict";
/* ===== Math Adventure — service worker (offline-first) =====
 * Precaches the small app shell so the game works fully offline. There are
 * no network dependencies, so once cached the app never needs the network.
 *
 * Compiled on its own (tsconfig.sw.json, webworker lib) into sw.js as a
 * classic worker script — no ES-module syntax in the output.
 */
/// <reference lib="webworker" />
const sw = self;
const CACHE = "math-adventure-v1";
const ASSETS = [
    "./",
    "./index.html",
    "./styles.css",
    "./app.js",
    "./manifest.webmanifest",
    "./icons/icon.svg",
    "./icons/icon-192.png",
    "./icons/icon-512.png",
    "./icons/apple-touch-icon.png",
];
sw.addEventListener("install", (event) => {
    event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => sw.skipWaiting()));
});
sw.addEventListener("activate", (event) => {
    event.waitUntil(caches
        .keys()
        .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
        .then(() => sw.clients.claim()));
});
// Cache-first for same-origin GETs; fall back to the network and cache new
// same-origin responses so subsequent loads are fully offline.
sw.addEventListener("fetch", (event) => {
    const req = event.request;
    if (req.method !== "GET")
        return;
    const url = new URL(req.url);
    if (url.origin !== sw.location.origin)
        return;
    event.respondWith(caches.match(req).then((cached) => {
        if (cached)
            return cached;
        return fetch(req)
            .then((res) => {
            if (res.ok && res.type === "basic") {
                const copy = res.clone();
                caches.open(CACHE).then((cache) => cache.put(req, copy));
            }
            return res;
        })
            .catch(() => caches.match("./index.html").then((r) => r ?? Response.error()));
    }));
});
