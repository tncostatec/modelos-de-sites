/* Service worker da Cantina Nonna Rosa.
 *
 * Estratégias:
 *  - shell do app (HTML, CSS, JS, ícone, manifesto): pré-cache na instalação e cache-first depois;
 *  - cardapio.json: network-first com fallback ao cache (o cardápio muda, mas precisa abrir sem rede);
 *  - navegação: network-first com fallback ao index.html em cache.
 *
 * Mudou algum arquivo do shell? Troque VERSAO; o `activate` apaga os caches antigos.
 * Caminhos relativos ao sw.js, porque o site pode viver num subcaminho (GitHub Pages). */
"use strict";

const VERSAO = "nonna-rosa-v1";
const PREFIXO = "nonna-rosa-";
const SHELL = [
  "./",
  "./index.html",
  "./config.js",
  "./cardapio.json", // entra no precache para a 1ª visita já funcionar offline; em uso, é network-first
  "./manifest.webmanifest",
  "./assets/css/estilo.css",
  "./assets/js/modelo.js",
  "./assets/js/carrinho.js",
  "./assets/js/cardapio.js",
  "./assets/js/pwa.js",
  "./assets/img/icone.svg"
];
const CARDAPIO = new URL("./cardapio.json", self.location.href).pathname;
const INDEX = new URL("./index.html", self.location.href).href;

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(VERSAO)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((chaves) => Promise.all(
        chaves
          .filter((chave) => chave.startsWith(PREFIXO) && chave !== VERSAO)
          .map((chave) => caches.delete(chave))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (evento) => {
  const { request } = evento;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // fontes do Google etc.: o navegador cuida

  if (url.pathname === CARDAPIO) {
    evento.respondWith(redeDepoisCache(request));
    return;
  }
  if (request.mode === "navigate") {
    evento.respondWith(redeDepoisCache(request, INDEX));
    return;
  }
  evento.respondWith(cacheDepoisRede(request));
});

async function redeDepoisCache(request, reserva) {
  const cache = await caches.open(VERSAO);
  try {
    const resposta = await fetch(request);
    if (resposta.ok) cache.put(request, resposta.clone());
    return resposta;
  } catch (erro) {
    const emCache = (await cache.match(request)) || (reserva && (await cache.match(reserva)));
    if (emCache) return emCache;
    throw erro;
  }
}

async function cacheDepoisRede(request) {
  const cache = await caches.open(VERSAO);
  const emCache = await cache.match(request);
  if (emCache) return emCache;
  const resposta = await fetch(request);
  if (resposta.ok) cache.put(request, resposta.clone());
  return resposta;
}
