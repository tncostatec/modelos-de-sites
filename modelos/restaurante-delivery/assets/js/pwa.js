/* Registro do service worker e botão "Instalar app".
 * Em file:// não há service worker; o registro é pulado em silêncio. */
(function () {
  "use strict";

  if (/^https?:$/.test(location.protocol) && "serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("./sw.js", { scope: "./" })
        .catch((erro) => console.warn("Service worker não registrado:", erro));
    });
  }

  const botao = document.getElementById("instalar");
  if (!botao) return;
  let pedidoInstalacao = null;

  window.addEventListener("beforeinstallprompt", (evento) => {
    evento.preventDefault();
    pedidoInstalacao = evento;
    botao.hidden = false;
  });

  botao.addEventListener("click", async () => {
    if (!pedidoInstalacao) return;
    pedidoInstalacao.prompt();
    const { outcome } = await pedidoInstalacao.userChoice;
    if (outcome === "accepted") botao.hidden = true;
    pedidoInstalacao = null;
  });

  window.addEventListener("appinstalled", () => { botao.hidden = true; });
})();
