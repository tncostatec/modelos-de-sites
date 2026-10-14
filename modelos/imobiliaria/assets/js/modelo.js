/* Lê window.MODELO (config.js), preenche os pontos data-modelo da página, monta os links de contato e cuida do
 * menu do celular. Também expõe utilidades e o módulo de favoritos usados pelos outros scripts. */
(function () {
  "use strict";

  const M = window.MODELO || {};
  const SVG_NS = "http://www.w3.org/2000/svg";

  /** Cria elemento HTML: h("p", { class: "x", "aria-label": "y" }, "texto", outroElemento) */
  function h(tag, atributos, ...filhos) {
    const el = document.createElement(tag);
    for (const [chave, valor] of Object.entries(atributos || {})) {
      if (valor === false || valor == null) continue;
      if (chave === "class") el.className = valor;
      else if (chave === "dataset") Object.assign(el.dataset, valor);
      else if (chave === "hidden" || chave === "disabled" || chave === "checked") el[chave] = Boolean(valor);
      else el.setAttribute(chave, valor === true ? "" : valor);
    }
    for (const filho of filhos.flat()) {
      if (filho == null || filho === false) continue;
      el.append(filho instanceof Node ? filho : document.createTextNode(String(filho)));
    }
    return el;
  }

  /** <svg><use href="#id"/></svg> apontando para um símbolo do sprite (fotos e ícones). */
  function svgUse(id, atributos) {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 400 300");
    svg.setAttribute("focusable", "false");
    for (const [chave, valor] of Object.entries(atributos || {})) svg.setAttribute(chave, valor);
    const use = document.createElementNS(SVG_NS, "use");
    use.setAttribute("href", `#${id}`);
    svg.append(use);
    return svg;
  }

  const formatoPreco = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  const formatoNumero = new Intl.NumberFormat("pt-BR");
  const formatoData = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

  /* ---------- textos vindos do config ---------- */
  const ler = (caminho) => caminho.split(".").reduce((obj, chave) => (obj == null ? undefined : obj[chave]), M);
  for (const el of document.querySelectorAll("[data-modelo]")) {
    const valor = ler(el.dataset.modelo);
    if (valor != null) el.textContent = String(valor);
  }

  const saudacao = `Olá! Vi o site da ${M.nome || "imobiliária"} e quero falar com um corretor.`;
  for (const el of document.querySelectorAll("[data-modelo-href]")) {
    const tipo = el.dataset.modeloHref;
    if (tipo === "whatsapp") {
      if (M.whatsapp) el.href = `https://wa.me/${M.whatsapp}?text=${encodeURIComponent(saudacao)}`;
      else el.hidden = true;
      el.target = "_blank";
      el.rel = "noopener";
    } else if (tipo === "telefone" && M.telefone) {
      el.href = `tel:+${(M.telefone.match(/\d/g) || []).join("")}`;
    } else if (tipo === "email" && M.email) {
      el.href = `mailto:${M.email}`;
    }
  }

  /* ---------- menu do celular ---------- */
  const botaoMenu = document.getElementById("menu-botao");
  const nav = document.getElementById("nav-principal");
  if (botaoMenu && nav) {
    const fechar = () => { nav.classList.remove("is-aberto"); botaoMenu.setAttribute("aria-expanded", "false"); };
    botaoMenu.addEventListener("click", () => {
      const aberto = nav.classList.toggle("is-aberto");
      botaoMenu.setAttribute("aria-expanded", String(aberto));
    });
    nav.addEventListener("click", (e) => { if (e.target.closest("a")) fechar(); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && nav.classList.contains("is-aberto")) { fechar(); botaoMenu.focus(); }
    });
  }

  /* ---------- favoritos (localStorage) ---------- */
  const CHAVE_FAVORITOS = "marco-zero.favoritos.v1";
  const favoritos = {
    lista() {
      try {
        const salvo = JSON.parse(localStorage.getItem(CHAVE_FAVORITOS));
        return Array.isArray(salvo) ? salvo.filter((id) => typeof id === "string") : [];
      } catch (_) { return []; }
    },
    tem(id) { return this.lista().includes(id); },
    /** Alterna e devolve true quando o imóvel passou a ser favorito. */
    alternar(id) {
      const lista = this.lista();
      const indice = lista.indexOf(id);
      if (indice >= 0) lista.splice(indice, 1); else lista.push(id);
      try { localStorage.setItem(CHAVE_FAVORITOS, JSON.stringify(lista)); } catch (_) { /* modo privado etc. */ }
      document.dispatchEvent(new CustomEvent("favoritos:mudou", { detail: { lista, id, salvo: indice < 0 } }));
      return indice < 0;
    }
  };

  window.MarcoZero = {
    config: M,
    h,
    svgUse,
    favoritos,
    preco: (valor) => formatoPreco.format(valor),
    numero: (valor) => formatoNumero.format(valor),
    data: (iso) => formatoData.format(new Date(`${iso}T12:00:00`))
  };
})();
