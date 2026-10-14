/* Menu: botão acessível no celular (aria-expanded/aria-controls), fecha com Esc e ao clicar num link;
   sombra no topo ao rolar; IntersectionObserver marca a seção visível com aria-current no menu. */
(function () {
  "use strict";

  var topo = document.querySelector("[data-topo]");
  var botao = document.querySelector("[data-menu-botao]");
  var menu = botao && document.getElementById(botao.getAttribute("aria-controls"));
  if (!topo || !botao || !menu) return;

  var mqDesktop = window.matchMedia("(min-width: 64em)");

  function abrir(estado) {
    botao.setAttribute("aria-expanded", String(estado));
    menu.classList.toggle("aberto", estado);
  }

  botao.addEventListener("click", function () {
    abrir(botao.getAttribute("aria-expanded") !== "true");
  });

  menu.addEventListener("click", function (e) {
    if (e.target.closest("a[href^='#'], button") && !mqDesktop.matches) abrir(false);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && botao.getAttribute("aria-expanded") === "true") {
      abrir(false);
      botao.focus();
    }
  });

  document.addEventListener("click", function (e) {
    if (!mqDesktop.matches && !topo.contains(e.target) && botao.getAttribute("aria-expanded") === "true") abrir(false);
  });

  // Ao crescer para desktop, garante o menu visível e o botão "fechado"
  mqDesktop.addEventListener("change", function (e) {
    if (e.matches) abrir(false);
  });

  // Sombra no topo depois de rolar
  function aoRolar() { topo.classList.toggle("rolado", window.scrollY > 8); }
  window.addEventListener("scroll", aoRolar, { passive: true });
  aoRolar();

  // Seção ativa no menu
  var links = Array.prototype.slice.call(menu.querySelectorAll("a[href^='#']"));
  var secoes = links
    .map(function (a) { return document.getElementById(a.getAttribute("href").slice(1)); })
    .filter(Boolean);

  if ("IntersectionObserver" in window && secoes.length) {
    var ativa = null;
    var visiveis = new Map();

    var observador = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (en) { visiveis.set(en.target.id, en.isIntersecting ? en.intersectionRatio : 0); });
      var melhor = null, maior = 0;
      secoes.forEach(function (s) {
        var r = visiveis.get(s.id) || 0;
        if (r > maior) { maior = r; melhor = s.id; }
      });
      if (melhor !== ativa) {
        ativa = melhor;
        links.forEach(function (a) {
          if (a.getAttribute("href") === "#" + ativa) a.setAttribute("aria-current", "true");
          else a.removeAttribute("aria-current");
        });
      }
    }, { rootMargin: "-35% 0px -50% 0px", threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] });

    secoes.forEach(function (s) { observador.observe(s); });
  }
})();
