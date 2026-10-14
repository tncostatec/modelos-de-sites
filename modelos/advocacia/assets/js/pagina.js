// Comportamentos de página: menu colapsável (teclado e Escape) e marcação de JS ativo.
(function () {
  "use strict";
  document.documentElement.classList.add("js");

  const botao = document.querySelector(".menu-botao");
  const menu = document.getElementById("menu-principal");
  if (!botao || !menu) return;

  const abrir = (aberto) => {
    botao.setAttribute("aria-expanded", String(aberto));
    menu.classList.toggle("aberto", aberto);
  };
  botao.addEventListener("click", () => abrir(botao.getAttribute("aria-expanded") !== "true"));
  menu.addEventListener("click", (e) => { if (e.target.closest("a")) abrir(false); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && botao.getAttribute("aria-expanded") === "true") { abrir(false); botao.focus(); }
  });
})();
