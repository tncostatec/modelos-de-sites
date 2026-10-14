/* Lê window.MODELO (config.js) e preenche a página: textos marcados com data-modelo, links de WhatsApp,
 * telefone e e-mail, menu do celular, tabela de horários e o status "aberto agora / fechado". */
(function () {
  "use strict";

  const M = window.MODELO || {};
  const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];
  const NOMES = { dom: "Domingo", seg: "Segunda-feira", ter: "Terça-feira", qua: "Quarta-feira", qui: "Quinta-feira", sex: "Sexta-feira", sab: "Sábado" };
  const ABREV = { dom: "dom.", seg: "seg.", ter: "ter.", qua: "qua.", qui: "qui.", sex: "sex.", sab: "sáb." };
  const formatoMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const moeda = (valor) => formatoMoeda.format(valor);

  /** Cria elemento: h("p", { class: "x", "aria-label": "y" }, "texto", outroElemento) */
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

  /* ---------- 1. textos vindos do config ---------- */
  const entrega = M.entrega || {};
  const retirada = M.retirada || {};
  const dados = Object.assign({}, M, {
    entrega_tempo: `${entrega.tempoMin}–${entrega.tempoMax} min`,
    retirada_tempo: `${retirada.tempoMin}–${retirada.tempoMax} min`,
    entrega_taxa: entrega.taxa ? moeda(entrega.taxa) : "Grátis",
    pedido_minimo: moeda(entrega.pedidoMinimo || 0)
  });
  const ler = (caminho) => caminho.split(".").reduce((obj, chave) => (obj == null ? undefined : obj[chave]), dados);

  for (const el of document.querySelectorAll("[data-modelo]")) {
    const valor = ler(el.dataset.modelo);
    if (valor != null) el.textContent = String(valor);
  }

  const saudacao = `Olá! Quero fazer um pedido na ${M.nome || "cantina"}.`;
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

  const mapa = document.getElementById("mapa");
  if (mapa && M.mapa) {
    const { lat, lng } = M.mapa;
    const d = 0.004;
    const bbox = [lng - d, lat - d, lng + d, lat + d].map((n) => n.toFixed(5)).join("%2C");
    mapa.src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;
  }

  /* ---------- 2. menu do celular ---------- */
  const botaoMenu = document.getElementById("menu-botao");
  const nav = document.getElementById("nav-principal");
  if (botaoMenu && nav) {
    const fecharMenu = () => { nav.classList.remove("is-aberto"); botaoMenu.setAttribute("aria-expanded", "false"); };
    botaoMenu.addEventListener("click", () => {
      const aberto = nav.classList.toggle("is-aberto");
      botaoMenu.setAttribute("aria-expanded", String(aberto));
    });
    nav.addEventListener("click", (e) => { if (e.target.closest("a")) fecharMenu(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && nav.classList.contains("is-aberto")) { fecharMenu(); botaoMenu.focus(); } });
  }

  /* ---------- 3. horários ---------- */
  const horarios = M.horarios || {};
  const paraMinutos = (hhmm) => { const [hh, mm] = hhmm.split(":").map(Number); return hh * 60 + mm; };

  /** Calcula se está aberto agora e quando abre/fecha. Puro: recebe a data para ser testável. */
  function statusAgora(agora = new Date()) {
    const diaIdx = agora.getDay();
    const minutos = agora.getHours() * 60 + agora.getMinutes();
    const hoje = horarios[DIAS[diaIdx]];
    if (hoje) {
      const [abre, fecha] = hoje.map(paraMinutos);
      if (minutos >= abre && minutos < fecha) return { aberto: true, fecha: hoje[1] };
      if (minutos < abre) return { aberto: false, abre: hoje[0], quando: "hoje" };
    }
    for (let i = 1; i <= 7; i++) {
      const dia = DIAS[(diaIdx + i) % 7];
      if (horarios[dia]) return { aberto: false, abre: horarios[dia][0], quando: i === 1 ? "amanhã" : ABREV[dia] };
    }
    return { aberto: false };
  }

  const status = document.getElementById("status");
  function atualizarStatus() {
    if (!status) return;
    const s = statusAgora();
    status.classList.toggle("status--aberto", s.aberto);
    status.classList.toggle("status--fechado", !s.aberto);
    status.querySelector(".status__texto").textContent = s.aberto ? "Aberto agora" : "Fechado";
    status.querySelector(".status__detalhe").textContent = s.aberto
      ? `fecha às ${s.fecha}`
      : s.abre ? `abre ${s.quando} às ${s.abre}` : "";
  }
  atualizarStatus();
  setInterval(atualizarStatus, 60 * 1000);

  const tabela = document.getElementById("horarios-tabela");
  if (tabela) {
    const hoje = DIAS[new Date().getDay()];
    for (const dia of ["seg", "ter", "qua", "qui", "sex", "sab", "dom"]) {
      const faixa = horarios[dia];
      const linha = h("tr", { class: [dia === hoje ? "is-hoje" : "", faixa ? "" : "is-fechado"].join(" ").trim() || null },
        h("td", null, NOMES[dia]),
        h("td", null, faixa ? `${faixa[0]} – ${faixa[1]}` : "Fechado")
      );
      tabela.append(linha);
    }
  }

  /* ---------- utilidades compartilhadas com os outros scripts ---------- */
  window.NonnaRosa = { h, moeda, statusAgora };
})();
