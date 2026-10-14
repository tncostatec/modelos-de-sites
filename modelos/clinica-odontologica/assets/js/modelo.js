/* Lê window.MODELO (config.js) e preenche o HTML:
   - [data-modelo="chave"]        → textContent (aceita caminho com ponto: "horarios.seg_sex")
   - [data-modelo-href="telefone"] → href="tel:…"
   - [data-modelo-href="email"]    → href="mailto:…"
   - [data-modelo-href="whatsapp"] → href="https://wa.me/…" (ou esconde [data-whatsapp] se não houver número)
   - [data-modelo-href="rota"]     → link "como chegar" no OpenStreetMap
   - iframe[data-mapa]             → src do mapa a partir de MODELO.mapa
   Expõe window.Modelo com utilitários usados pelo agenda.js. */
(function () {
  "use strict";

  var M = window.MODELO || {};

  function ler(obj, caminho) {
    return caminho.split(".").reduce(function (acc, parte) {
      return acc != null ? acc[parte] : undefined;
    }, obj);
  }

  function digitos(valor) {
    return String(valor || "").replace(/\D/g, "");
  }

  function linkWhatsApp(texto) {
    var numero = digitos(M.whatsapp);
    if (!numero) return "";
    return "https://wa.me/" + numero + (texto ? "?text=" + encodeURIComponent(texto) : "");
  }

  // Texto
  document.querySelectorAll("[data-modelo]").forEach(function (el) {
    var valor = ler(M, el.getAttribute("data-modelo"));
    if (valor != null && valor !== "") el.textContent = valor;
  });

  // Links
  var tel = digitos(M.telefone);
  document.querySelectorAll("[data-modelo-href]").forEach(function (el) {
    switch (el.getAttribute("data-modelo-href")) {
      case "telefone":
        if (tel) el.href = "tel:+55" + tel;
        break;
      case "email":
        if (M.email) el.href = "mailto:" + M.email;
        break;
      case "whatsapp":
        el.href = linkWhatsApp("Olá! Vim pelo site da " + (M.nome || "clínica") + " e gostaria de agendar uma avaliação.");
        break;
      case "rota":
        if (M.mapa) el.href = "https://www.openstreetmap.org/directions?to=" + M.mapa.lat + "%2C" + M.mapa.lng;
        break;
    }
  });

  // Sem número de WhatsApp? Some com os botões.
  if (!digitos(M.whatsapp)) {
    document.querySelectorAll("[data-whatsapp]").forEach(function (el) { el.hidden = true; });
  }

  // Mapa (OpenStreetMap, sem chave de API)
  var mapa = document.querySelector("iframe[data-mapa]");
  if (mapa && M.mapa && isFinite(M.mapa.lat) && isFinite(M.mapa.lng)) {
    var lat = Number(M.mapa.lat), lng = Number(M.mapa.lng);
    var bbox = [lng - 0.008, lat - 0.005, lng + 0.008, lat + 0.005].map(function (n) { return n.toFixed(4); }).join("%2C");
    var src = "https://www.openstreetmap.org/export/embed.html?bbox=" + bbox + "&layer=mapnik&marker=" + lat + "%2C" + lng;
    if (mapa.getAttribute("src") !== src) mapa.src = src;
  }

  window.Modelo = { config: M, digitos: digitos, linkWhatsApp: linkWhatsApp };
})();
