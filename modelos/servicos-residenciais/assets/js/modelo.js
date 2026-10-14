// Preenche o HTML com os dados de window.MODELO (config.js): textos, links de telefone/WhatsApp/e-mail e mapa.
(function () {
  "use strict";
  const M = window.MODELO || {};
  const digitos = (s) => String(s || "").replace(/\D/g, "");

  // textos: data-modelo="telefone", data-modelo="horarios.sab" etc.
  document.querySelectorAll("[data-modelo]").forEach((el) => {
    const chave = el.getAttribute("data-modelo");
    const valor = chave.startsWith("horarios.") ? (M.horarios || {})[chave.slice(9)] : M[chave];
    if (valor !== undefined && valor !== null && valor !== "") el.textContent = valor;
  });

  const tel = digitos(M.telefone);
  const wa = digitos(M.whatsapp);

  document.querySelectorAll('[data-modelo-link="telefone"]').forEach((a) => {
    if (tel) a.href = "tel:+" + (wa || "55" + tel);
  });
  document.querySelectorAll('[data-modelo-link="email"]').forEach((a) => {
    if (M.email) a.href = "mailto:" + M.email;
  });
  document.querySelectorAll('[data-modelo-link="whatsapp"]').forEach((a) => {
    if (!wa) { a.hidden = true; return; }
    const texto = a.getAttribute("data-whatsapp-texto") || "";
    a.href = "https://wa.me/" + wa + (texto ? "?text=" + encodeURIComponent(texto) : "");
  });

  // mapa (OpenStreetMap embutido, lazy): o iframe só ganha src se houver coordenadas
  const mapa = M.mapa;
  document.querySelectorAll("[data-modelo-mapa]").forEach((iframe) => {
    if (!mapa || typeof mapa.lat !== "number") { iframe.closest(".mapa").hidden = true; return; }
    const d = 0.02;
    const bbox = [mapa.lng - d, mapa.lat - d * 0.6, mapa.lng + d, mapa.lat + d * 0.6].join(",");
    iframe.src = "https://www.openstreetmap.org/export/embed.html?bbox=" + bbox + "&layer=mapnik&marker=" + mapa.lat + "," + mapa.lng;
  });
  document.querySelectorAll('[data-modelo-link="mapa"]').forEach((a) => {
    if (mapa) a.href = "https://www.openstreetmap.org/?mlat=" + mapa.lat + "&mlon=" + mapa.lng + "#map=15/" + mapa.lat + "/" + mapa.lng;
  });

  document.querySelectorAll("[data-ano]").forEach((el) => { el.textContent = String(new Date().getFullYear()); });
})();
