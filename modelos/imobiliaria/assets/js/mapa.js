/* Camada fina sobre o Leaflet 1.9.4 (carregado por CDN com integrity): cria mapas com tiles do OpenStreetMap
 * e marcadores em SVG inline (o "marco" da identidade visual), sem nenhuma imagem externa além dos tiles. */
(function () {
  "use strict";

  const MZ = window.MarcoZero;

  const disponivel = () => typeof window.L !== "undefined";

  const MARCO_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">'
    + '<circle cx="12" cy="12" r="6" fill="#FBF8F1" stroke="currentColor" stroke-width="2.2"/>'
    + '<path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'
    + '<circle cx="12" cy="12" r="2.2" fill="currentColor"/></svg>';

  function icone(ativo) {
    return L.divIcon({
      className: `marcador${ativo ? " marcador--ativo" : ""}`,
      html: MARCO_SVG,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, -14]
    });
  }

  /** Cria um mapa no elemento, centrado em {lat, lng, zoom}. */
  function criar(elemento, { lat, lng, zoom }) {
    const mapa = L.map(elemento, { scrollWheelZoom: false }).setView([lat, lng], zoom);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
    }).addTo(mapa);
    return mapa;
  }

  /** Marcador de um imóvel, com popup opcional (HTML já escapado). */
  function marcador(imovel, popupHtml, ativo = false) {
    const m = L.marker([imovel.lat, imovel.lng], { icon: icone(ativo), title: imovel.titulo, keyboard: true });
    if (popupHtml) m.bindPopup(popupHtml, { maxWidth: 260 });
    return m;
  }

  MZ.mapa = { disponivel, criar, marcador };
})();
