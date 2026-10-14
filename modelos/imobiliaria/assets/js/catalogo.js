/* Catálogo client-side: carrega imoveis.json, mantém os filtros em URLSearchParams (compartilhável; voltar e
 * avançar funcionam), pagina, alterna lista/mapa, cuida dos favoritos e roteia #/imovel/<id> para o detalhe. */
(function () {
  "use strict";

  const MZ = window.MarcoZero;
  const { h, svgUse, preco, favoritos } = MZ;
  const M = MZ.config;
  const POR_PAGINA = (M.catalogo && M.catalogo.porPagina) || 6;
  const FINALIDADES = ["venda", "aluguel"];
  const ORDENS = {
    recentes: (a, b) => b.publicadoEm.localeCompare(a.publicadoEm),
    "preco-asc": (a, b) => a.preco - b.preco,
    "preco-desc": (a, b) => b.preco - a.preco,
    "area-desc": (a, b) => b.area - a.area
  };
  const PADRAO = { finalidade: "", tipo: "", bairro: "", min: 0, max: 0, quartos: 0, ordem: "recentes", pagina: 1, favoritos: false, vista: "lista" };
  const TITULO_ORIGINAL = document.title;

  const $ = (id) => document.getElementById(id);
  const el = {
    contagem: $("resultado-contagem"), titulo: $("catalogo-titulo"), resultados: $("resultados"), vazio: $("resultados-vazio"),
    erro: $("catalogo-erro"), recarregar: $("catalogo-recarregar"), paginacao: $("paginacao"),
    mapaCaixa: $("mapa-lista-caixa"), mapa: $("mapa-lista"), mapaAviso: $("mapa-lista-aviso"),
    filtros: $("filtros-painel"), filtrosBotao: $("filtros-botao"), filtrosAtivos: $("filtros-ativos"), ordem: $("ordem"),
    vistaLista: $("vista-lista"), vistaMapa: $("vista-mapa"), buscaRapida: $("busca-rapida"),
    favoritosLink: $("favoritos-link"), favoritosContagem: $("favoritos-contagem"),
    detalhe: $("detalhe"), detalheTitulo: $("detalhe-titulo"), voltar: $("detalhe-voltar")
  };
  const secoesLista = document.querySelectorAll("[data-vista-lista]");

  let dados = { imoveis: [], bairros: {}, tipos: {} };
  let porId = new Map();
  let filtros = lerFiltros();
  let mapaLista = null;
  let camadaMarcadores = null;
  let veioDaLista = false;   // o detalhe foi aberto a partir desta lista? então "voltar" = history.back()
  let noDetalhe = false;
  let avisoRota = "";        // ex.: "imóvel X não está mais disponível", mostrado junto da contagem

  /* ---------- estado na URL ---------- */
  function lerFiltros() {
    const p = new URLSearchParams(location.search);
    const inteiro = (chave) => Math.max(0, parseInt(p.get(chave), 10) || 0);
    return {
      finalidade: FINALIDADES.includes(p.get("finalidade")) ? p.get("finalidade") : "",
      tipo: p.get("tipo") || "",
      bairro: p.get("bairro") || "",
      min: inteiro("min"),
      max: inteiro("max"),
      quartos: Math.min(4, inteiro("quartos")),
      ordem: p.get("ordem") in ORDENS ? p.get("ordem") : "recentes",
      pagina: Math.max(1, inteiro("pagina")),
      favoritos: p.get("favoritos") === "1",
      vista: p.get("vista") === "mapa" ? "mapa" : "lista"
    };
  }
  function escreverFiltros(push) {
    const p = new URLSearchParams();
    for (const [chave, valor] of Object.entries(filtros)) {
      if (valor === PADRAO[chave]) continue;
      p.set(chave, valor === true ? "1" : String(valor));
    }
    const consulta = p.toString();
    const hash = location.hash.startsWith("#/") ? "" : location.hash;
    const url = `${location.pathname}${consulta ? `?${consulta}` : ""}${hash}`;
    history[push ? "pushState" : "replaceState"](null, "", url);
  }
  function filtrosAtivos() {
    return ["finalidade", "tipo", "bairro", "min", "max", "quartos", "favoritos"].filter((chave) => filtros[chave] !== PADRAO[chave]).length;
  }

  /* ---------- formulário de filtros ---------- */
  function sincronizarFormulario() {
    const f = el.filtros.elements;
    f.finalidade.value = filtros.finalidade;
    f.tipo.value = filtros.tipo;
    f.bairro.value = filtros.bairro;
    f.min.value = filtros.min || "";
    f.max.value = filtros.max || "";
    f.quartos.value = filtros.quartos || "";
    f.favoritos.checked = filtros.favoritos;
    el.ordem.value = filtros.ordem;
    const r = el.buscaRapida.elements;
    r.finalidade.value = filtros.finalidade;
    r.tipo.value = filtros.tipo;
    r.bairro.value = filtros.bairro;
  }
  function lerDoFormulario() {
    const f = el.filtros.elements;
    filtros.finalidade = f.finalidade.value;
    filtros.tipo = f.tipo.value;
    filtros.bairro = f.bairro.value;
    filtros.min = Math.max(0, parseInt(f.min.value, 10) || 0);
    filtros.max = Math.max(0, parseInt(f.max.value, 10) || 0);
    filtros.quartos = parseInt(f.quartos.value, 10) || 0;
    filtros.favoritos = f.favoritos.checked;
  }
  function aplicar({ rolar = false } = {}) {
    avisoRota = "";
    filtros.pagina = 1;
    sincronizarFormulario();
    escreverFiltros(true);
    renderLista();
    if (rolar) irParaResultados();
  }
  function irParaResultados() {
    el.titulo.scrollIntoView({ block: "start" });
    el.titulo.focus({ preventScroll: true });
  }

  el.filtros.addEventListener("change", () => { lerDoFormulario(); aplicar(); });
  el.filtros.addEventListener("submit", (e) => { e.preventDefault(); lerDoFormulario(); aplicar({ rolar: true }); });
  el.ordem.addEventListener("change", () => { filtros.ordem = el.ordem.value; aplicar(); });
  for (const botao of document.querySelectorAll("#limpar-filtros, [data-limpar]")) {
    botao.addEventListener("click", () => { filtros = Object.assign({}, PADRAO, { vista: filtros.vista }); aplicar(); });
  }
  el.filtrosBotao.addEventListener("click", () => {
    const aberto = el.filtros.classList.toggle("is-aberto");
    el.filtrosBotao.setAttribute("aria-expanded", String(aberto));
  });
  el.vistaLista.addEventListener("click", () => { filtros.vista = "lista"; escreverFiltros(true); renderLista(); });
  el.vistaMapa.addEventListener("click", () => { filtros.vista = "mapa"; escreverFiltros(true); renderLista(); });

  el.buscaRapida.addEventListener("submit", (e) => {
    e.preventDefault();
    const r = el.buscaRapida.elements;
    filtros.finalidade = r.finalidade.value;
    filtros.tipo = r.tipo.value;
    filtros.bairro = r.bairro.value;
    aplicar({ rolar: true });
  });
  for (const regiao of document.querySelectorAll(".regiao")) {
    regiao.addEventListener("click", (e) => {
      e.preventDefault();
      filtros.bairro = regiao.dataset.bairro;
      aplicar({ rolar: true });
    });
  }
  el.favoritosLink.addEventListener("click", (e) => {
    e.preventDefault();
    filtros.favoritos = true;
    if (noDetalhe) { location.hash = "#imoveis"; }
    aplicar({ rolar: true });
  });

  /* ---------- favoritos ---------- */
  function atualizarFavoritos(detalhe) {
    const lista = favoritos.lista();
    el.favoritosContagem.textContent = String(lista.length);
    el.favoritosLink.setAttribute("aria-label", lista.length ? `Ver favoritos: ${lista.length}` : "Ver favoritos: nenhum salvo");
    el.favoritosLink.classList.toggle("tem-favoritos", lista.length > 0);
    for (const botao of el.resultados.querySelectorAll("[data-favorito]")) {
      const salvo = lista.includes(botao.dataset.favorito);
      botao.setAttribute("aria-pressed", String(salvo));
      botao.setAttribute("aria-label", `${salvo ? "Remover dos favoritos" : "Salvar nos favoritos"}: ${botao.dataset.titulo}`);
    }
    if (detalhe && filtros.favoritos && !noDetalhe) renderLista();
  }
  document.addEventListener("favoritos:mudou", (e) => atualizarFavoritos(e.detail));
  el.resultados.addEventListener("click", (e) => {
    const botao = e.target.closest("[data-favorito]");
    if (botao) { favoritos.alternar(botao.dataset.favorito); return; }
    if (e.target.closest("a.card__link")) veioDaLista = true;
  });
  el.mapa.addEventListener("click", (e) => { if (e.target.closest('a[href^="#/imovel/"]')) veioDaLista = true; });

  /* ---------- renderização ---------- */
  function filtrar() {
    const salvos = favoritos.lista();
    return dados.imoveis.filter((im) =>
      (!filtros.finalidade || im.finalidade === filtros.finalidade)
      && (!filtros.tipo || im.tipo === filtros.tipo)
      && (!filtros.bairro || im.bairro === filtros.bairro)
      && (!filtros.min || im.preco >= filtros.min)
      && (!filtros.max || im.preco <= filtros.max)
      && (!filtros.quartos || im.quartos >= filtros.quartos)
      && (!filtros.favoritos || salvos.includes(im.id))
    ).sort(ORDENS[filtros.ordem]);
  }

  function renderCard(im) {
    const aluguel = im.finalidade === "aluguel";
    const salvo = favoritos.tem(im.id);
    return h("article", { class: "card", dataset: { id: im.id } },
      h("div", { class: "card__midia" },
        svgUse(`foto-${im.fotos[0]}`, { class: "foto", "aria-hidden": "true" }),
        h("span", { class: `card__etiqueta card__etiqueta--${im.finalidade}` }, aluguel ? "Aluguel" : "Venda"),
        h("button", {
          type: "button", class: "favorito", "aria-pressed": String(salvo),
          "aria-label": `${salvo ? "Remover dos favoritos" : "Salvar nos favoritos"}: ${im.titulo}`,
          dataset: { favorito: im.id, titulo: im.titulo }
        }, svgUse("icone-coracao", { viewBox: "0 0 24 24", "aria-hidden": "true" }))),
      h("div", { class: "card__corpo" },
        h("p", { class: "card__preco" }, preco(im.preco), aluguel ? h("span", { class: "card__periodo" }, "/mês") : null),
        h("h3", { class: "card__titulo" }, h("a", { class: "card__link", href: `#/imovel/${im.id}` }, im.titulo)),
        h("p", { class: "card__local" }, `${dados.bairros[im.bairro] || im.bairro} · ${dados.tipos[im.tipo] || im.tipo} · ${im.id}`),
        h("ul", { class: "atributos" }, MZ.detalhe.atributos(im)))
    );
  }

  function renderPaginacao(paginas) {
    el.paginacao.replaceChildren();
    if (paginas <= 1) { el.paginacao.hidden = true; return; }
    const botao = (rotulo, pagina, extra) => h("button", Object.assign({ type: "button", class: "paginacao__botao", dataset: { pagina } }, extra), rotulo);
    el.paginacao.append(botao("‹", filtros.pagina - 1, { "aria-label": "Página anterior", disabled: filtros.pagina === 1 }));
    for (let i = 1; i <= paginas; i++) {
      el.paginacao.append(botao(String(i), i, { "aria-label": `Página ${i}`, "aria-current": i === filtros.pagina ? "page" : null }));
    }
    el.paginacao.append(botao("›", filtros.pagina + 1, { "aria-label": "Próxima página", disabled: filtros.pagina === paginas }));
    el.paginacao.hidden = filtros.vista === "mapa";
  }
  el.paginacao.addEventListener("click", (e) => {
    const botao = e.target.closest("[data-pagina]");
    if (!botao || botao.disabled) return;
    filtros.pagina = Number(botao.dataset.pagina);
    escreverFiltros(true);
    renderLista();
    irParaResultados();
  });

  const escapar = (texto) => String(texto).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  function renderMapa(lista) {
    if (!MZ.mapa.disponivel()) { el.mapaAviso.hidden = false; return; }
    el.mapaAviso.hidden = true;
    if (!mapaLista) {
      mapaLista = MZ.mapa.criar(el.mapa, M.mapa);
      camadaMarcadores = L.layerGroup().addTo(mapaLista);
    }
    camadaMarcadores.clearLayers();
    for (const im of lista) {
      const popup = `<strong>${escapar(im.titulo)}</strong><br>${escapar(preco(im.preco))}${im.finalidade === "aluguel" ? "/mês" : ""} · ${escapar(dados.bairros[im.bairro] || im.bairro)}<br><a href="#/imovel/${escapar(im.id)}">Ver imóvel</a>`;
      camadaMarcadores.addLayer(MZ.mapa.marcador(im, popup));
    }
    setTimeout(() => {
      mapaLista.invalidateSize();
      if (lista.length) mapaLista.fitBounds(lista.map((im) => [im.lat, im.lng]), { padding: [40, 40], maxZoom: 15 });
      else mapaLista.setView([M.mapa.lat, M.mapa.lng], M.mapa.zoom);
    }, 0);
  }

  function renderLista() {
    const lista = filtrar();
    const total = lista.length;
    const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
    if (filtros.pagina > paginas) { filtros.pagina = paginas; escreverFiltros(false); }
    const inicio = (filtros.pagina - 1) * POR_PAGINA;
    const emMapa = filtros.vista === "mapa";

    el.contagem.textContent = (avisoRota ? `${avisoRota} ` : "")
      + (total === 0 ? "Nenhum imóvel encontrado" : total === 1 ? "1 imóvel encontrado" : `${total} imóveis encontrados`)
      + (paginas > 1 && !emMapa ? ` · página ${filtros.pagina} de ${paginas}` : "");
    el.resultados.replaceChildren(...lista.slice(inicio, inicio + POR_PAGINA).map(renderCard));
    el.resultados.removeAttribute("aria-busy");
    renderPaginacao(paginas);

    const n = filtrosAtivos();
    el.filtrosAtivos.hidden = n === 0;
    el.filtrosAtivos.textContent = String(n);
    el.vistaLista.setAttribute("aria-pressed", String(!emMapa));
    el.vistaMapa.setAttribute("aria-pressed", String(emMapa));
    el.resultados.hidden = emMapa;
    el.vazio.hidden = emMapa || total > 0;
    el.mapaCaixa.hidden = !emMapa;
    if (emMapa) renderMapa(lista);
    atualizarFavoritos();
  }

  /* ---------- rotas ---------- */
  const rotaDetalhe = () => (location.hash.match(/^#\/imovel\/([A-Za-z0-9-]+)$/) || [])[1] || null;

  function renderRota() {
    const id = rotaDetalhe();
    const imovel = id ? porId.get(id) : null;
    if (id && !imovel && dados.imoveis.length) {
      // código inexistente (link antigo): volta para a lista sem deixar a rota quebrada no histórico
      history.replaceState(null, "", `${location.pathname}${location.search}#imoveis`);
      avisoRota = `O imóvel ${id} não está mais disponível.`;
      renderLista();
    }
    if (imovel) {
      avisoRota = "";
      secoesLista.forEach((s) => { s.hidden = true; });
      el.detalhe.hidden = false;
      MZ.detalhe.mostrar(imovel, dados);
      window.scrollTo({ top: 0 });
      el.detalheTitulo.focus({ preventScroll: true });
      noDetalhe = true;
      return;
    }
    const voltando = noDetalhe;
    noDetalhe = false;
    el.detalhe.hidden = true;
    secoesLista.forEach((s) => { s.hidden = false; });
    document.title = TITULO_ORIGINAL;
    if (voltando) { irParaResultados(); veioDaLista = false; }
  }

  function aoNavegar() {
    filtros = lerFiltros();
    sincronizarFormulario();
    renderLista();
    renderRota();
  }
  // popstate e hashchange disparam em tarefas separadas numa troca de hash: agrupa num único render
  let navegacaoAgendada = 0;
  const agendarNavegacao = () => {
    clearTimeout(navegacaoAgendada);
    navegacaoAgendada = setTimeout(aoNavegar, 0);
  };
  window.addEventListener("popstate", agendarNavegacao);
  window.addEventListener("hashchange", agendarNavegacao);
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";

  el.voltar.addEventListener("click", () => {
    if (veioDaLista && history.length > 1) history.back();
    else location.hash = "#imoveis";
  });

  /* ---------- carga ---------- */
  function preencherOpcoes() {
    for (const select of document.querySelectorAll("select[data-opcoes]")) {
      const dicionario = dados[select.dataset.opcoes] || {};
      for (const [valor, nome] of Object.entries(dicionario)) select.append(h("option", { value: valor }, nome));
    }
    for (const texto of document.querySelectorAll("[data-contagem]")) {
      const n = dados.imoveis.filter((im) => im.bairro === texto.dataset.contagem).length;
      texto.textContent = `${n} ${n === 1 ? "imóvel" : "imóveis"}`;
      const link = texto.closest(".regiao");
      if (link) link.setAttribute("aria-label", `${dados.bairros[texto.dataset.contagem] || ""}: ${texto.textContent}`);
    }
  }

  async function carregar() {
    el.erro.hidden = true;
    el.resultados.setAttribute("aria-busy", "true");
    try {
      const resposta = await fetch("imoveis.json", { cache: "no-cache" });
      if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
      dados = await resposta.json();
      porId = new Map(dados.imoveis.map((im) => [im.id, im]));
      preencherOpcoes();
      aoNavegar();
    } catch (_) {
      el.erro.hidden = false;
      el.resultados.removeAttribute("aria-busy");
      el.contagem.textContent = "Não foi possível carregar os imóveis.";
    }
  }
  el.recarregar.addEventListener("click", carregar);
  carregar();
})();
