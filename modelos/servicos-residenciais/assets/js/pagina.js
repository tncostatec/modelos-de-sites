// Comportamentos de página: menu colapsável, animações de entrada (IntersectionObserver) e comparador antes/depois.
(function () {
  "use strict";
  const html = document.documentElement;
  html.classList.add("js");
  const movimentoReduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---- menu ----
  const botao = document.querySelector(".menu-botao");
  const menu = document.getElementById("menu-principal");
  if (botao && menu) {
    const abrir = (aberto) => {
      botao.setAttribute("aria-expanded", String(aberto));
      menu.classList.toggle("aberto", aberto);
    };
    botao.addEventListener("click", () => abrir(botao.getAttribute("aria-expanded") !== "true"));
    menu.addEventListener("click", (e) => { if (e.target.closest("a")) abrir(false); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && botao.getAttribute("aria-expanded") === "true") { abrir(false); botao.focus(); }
    });
  }

  // ---- animações de entrada: só com JS, só sem prefers-reduced-motion (o CSS cuida do resto) ----
  const reveladores = document.querySelectorAll(".revelar");
  if (reveladores.length && !movimentoReduzido && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((entradas) => {
      entradas.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add("visivel"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.15 });
    reveladores.forEach((el) => io.observe(el));
  } else {
    reveladores.forEach((el) => el.classList.add("visivel"));
  }

  // ---- comparador antes/depois ----
  const comparador = document.querySelector(".comparador");
  if (comparador) {
    const controle = comparador.querySelector(".comparador-controle");
    const cenas = comparador.querySelector(".comparador-cenas");
    const aplicar = () => {
      const v = Number(controle.value);
      comparador.style.setProperty("--pos", v + "%");
      controle.setAttribute("aria-valuetext", v === 50 ? "metade antes, metade depois" : v + "% antes, " + (100 - v) + "% depois");
    };
    controle.addEventListener("input", aplicar);
    aplicar();

    // arrastar direto na imagem (espelha o <input type="range">); touch-action: pan-y deixa a rolagem vertical livre
    let arrastando = false;
    const definirPorX = (x) => {
      const r = cenas.getBoundingClientRect();
      controle.value = String(Math.round(Math.min(100, Math.max(0, ((x - r.left) / r.width) * 100))));
      aplicar();
    };
    cenas.addEventListener("pointerdown", (e) => {
      arrastando = true;
      cenas.setPointerCapture(e.pointerId);
      definirPorX(e.clientX);
    });
    cenas.addEventListener("pointermove", (e) => { if (arrastando) definirPorX(e.clientX); });
    ["pointerup", "pointercancel"].forEach((t) => cenas.addEventListener(t, () => { arrastando = false; }));
  }
})();
