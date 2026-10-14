/* Cardápio dirigido por dados: carrega cardapio.json, renderiza categorias e pratos, busca por texto,
 * filtro por etiqueta, navegação fixa de categorias com destaque da ativa e os destaques da lousa. */
(function () {
  "use strict";

  const { h, moeda } = window.NonnaRosa;
  const Carrinho = window.Carrinho;
  const $ = (id) => document.getElementById(id);
  const el = {
    lista: $("cardapio-lista"), vazio: $("cardapio-vazio"), erro: $("cardapio-erro"), recarregar: $("cardapio-recarregar"),
    contagem: $("cardapio-contagem"), categorias: $("categorias-lista"), busca: $("busca"), etiquetas: $("etiquetas"), lousa: $("lousa-lista")
  };

  let rotulos = {};          // id da etiqueta -> texto
  let texto = "";            // termo da busca
  const ativas = new Set();  // etiquetas selecionadas (todas precisam bater)

  const normalizar = (s) => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const variavel = (nome, padrao) => parseInt(getComputedStyle(document.documentElement).getPropertyValue(nome), 10) || padrao;

  /* ---------- carga ---------- */
  async function carregar() {
    el.erro.hidden = true;
    el.lista.setAttribute("aria-busy", "true");
    try {
      const resposta = await fetch("cardapio.json", { cache: "no-cache" });
      if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
      render(await resposta.json());
    } catch (_) {
      el.erro.hidden = false;
      el.lousa.replaceChildren(h("li", { class: "lousa__item lousa__item--vazio" }, "Cardápio indisponível no momento."));
    } finally {
      el.lista.removeAttribute("aria-busy");
    }
  }
  el.recarregar.addEventListener("click", carregar);

  /* ---------- renderização ---------- */
  function render(dados) {
    rotulos = dados.etiquetas || {};
    const todos = dados.categorias.flatMap((c) => c.itens.map((i) => Object.assign({ categoria: c.id }, i)));
    Carrinho.definirCardapio(todos);

    el.categorias.replaceChildren(...dados.categorias.map((c) =>
      h("li", null, h("a", { class: "categorias__link", href: `#cat-${c.id}`, dataset: { categoria: c.id } }, c.nome))
    ));

    el.etiquetas.replaceChildren(...Object.entries(rotulos).map(([id, nome]) =>
      h("button", { type: "button", class: "chip", "aria-pressed": "false", dataset: { etiqueta: id } }, nome)
    ));

    el.lista.replaceChildren(...dados.categorias.map((c) =>
      h("section", { class: "categoria", id: `cat-${c.id}`, "aria-labelledby": `cat-${c.id}-titulo`, dataset: { categoria: c.id } },
        h("header", { class: "categoria__cabeca" },
          h("h3", { id: `cat-${c.id}-titulo` }, c.nome),
          c.descricao ? h("p", { class: "categoria__descricao" }, c.descricao) : null),
        h("ul", { class: "pratos" }, c.itens.map(renderPrato)))
    ));

    const destaques = todos.filter((p) => p.destaque && p.disponivel !== false).slice(0, 4);
    el.lousa.replaceChildren(...destaques.map((p) =>
      h("li", { class: "lousa__item" },
        h("button", { type: "button", class: "lousa__botao", dataset: { adicionar: p.id }, "aria-label": `Adicionar ${p.nome} ao pedido` },
          h("span", { class: "lousa__nome" }, p.nome),
          h("span", { class: "pontos", "aria-hidden": "true" }),
          h("span", { class: "lousa__preco" }, moeda(p.preco))))
    ));

    aplicarFiltros();
    atualizarAtiva();
  }

  function renderPrato(p) {
    const esgotado = p.disponivel === false;
    const etiquetas = (p.etiquetas || []).map((t) => h("li", { class: `etiqueta etiqueta--${t}` }, rotulos[t] || t));
    if (esgotado) etiquetas.unshift(h("li", { class: "etiqueta etiqueta--esgotado" }, "Esgotado hoje"));
    return h("li", {
      class: `prato${esgotado ? " prato--esgotado" : ""}`,
      dataset: { id: p.id, busca: normalizar(`${p.nome} ${p.descricao}`), etiquetas: (p.etiquetas || []).join(" ") }
    },
      h("div", { class: "prato__linha" },
        h("h4", { class: "prato__nome" }, p.nome),
        h("span", { class: "pontos", "aria-hidden": "true" }),
        h("span", { class: "prato__preco" }, moeda(p.preco))),
      h("p", { class: "prato__descricao" }, p.descricao),
      h("div", { class: "prato__rodape" },
        etiquetas.length ? h("ul", { class: "prato__etiquetas", "aria-label": "Características" }, etiquetas) : null,
        h("span", { class: "prato__no-pedido", dataset: { noPedido: p.id }, hidden: true }),
        h("button", {
          type: "button", class: "botao botao--primario botao--pequeno",
          dataset: { adicionar: p.id }, "aria-label": `Adicionar ${p.nome} ao pedido`, disabled: esgotado
        }, esgotado ? "Esgotado" : "Adicionar"))
    );
  }

  /* ---------- busca e filtros ---------- */
  function aplicarFiltros() {
    const termo = normalizar(texto.trim());
    let visiveis = 0;
    for (const secao of el.lista.querySelectorAll(".categoria")) {
      let n = 0;
      for (const prato of secao.querySelectorAll(".prato")) {
        const tags = prato.dataset.etiquetas.split(" ");
        const ok = (!termo || prato.dataset.busca.includes(termo)) && [...ativas].every((t) => tags.includes(t));
        prato.hidden = !ok;
        if (ok) n++;
      }
      secao.hidden = n === 0;
      const link = el.categorias.querySelector(`[data-categoria="${secao.dataset.categoria}"]`);
      if (link) link.parentElement.hidden = n === 0;
      visiveis += n;
    }
    el.vazio.hidden = visiveis > 0;
    if (el.contagem) {
      el.contagem.textContent = termo || ativas.size ? `${visiveis} ${visiveis === 1 ? "prato encontrado" : "pratos encontrados"}` : "";
    }
    atualizarAtiva();
  }

  let temporizador = 0;
  el.busca.addEventListener("input", () => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => { texto = el.busca.value; aplicarFiltros(); }, 120);
  });
  el.etiquetas.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    const ligado = chip.getAttribute("aria-pressed") !== "true";
    chip.setAttribute("aria-pressed", String(ligado));
    if (ligado) ativas.add(chip.dataset.etiqueta); else ativas.delete(chip.dataset.etiqueta);
    aplicarFiltros();
  });

  /* ---------- adicionar ao pedido (cardápio e lousa) ---------- */
  for (const raiz of [el.lista, el.lousa]) {
    raiz.addEventListener("click", (e) => {
      const botao = e.target.closest("[data-adicionar]");
      if (botao && !botao.disabled) Carrinho.adicionar(botao.dataset.adicionar);
    });
  }
  document.addEventListener("carrinho:mudou", (e) => {
    for (const marca of el.lista.querySelectorAll("[data-no-pedido]")) {
      const q = e.detail.quantidades[marca.dataset.noPedido] || 0;
      marca.hidden = !q;
      marca.textContent = q ? `${q} no pedido` : "";
    }
  });

  /* ---------- categoria ativa conforme a rolagem ---------- */
  function atualizarAtiva() {
    const limite = variavel("--topo", 64) + variavel("--categorias", 58) + 24;
    const secoes = [...el.lista.querySelectorAll(".categoria:not([hidden])")];
    if (!secoes.length) return;
    let atual = secoes[0];
    for (const secao of secoes) {
      if (secao.getBoundingClientRect().top <= limite) atual = secao; else break;
    }
    for (const link of el.categorias.querySelectorAll(".categorias__link")) {
      const ativo = link.dataset.categoria === atual.dataset.categoria;
      if (ativo) link.setAttribute("aria-current", "true"); else link.removeAttribute("aria-current");
      if (ativo) {
        // mantém o link ativo à vista na faixa rolável (sem mexer na rolagem vertical da página)
        const faixa = el.categorias;
        const esquerda = link.offsetLeft - faixa.offsetLeft;
        if (esquerda < faixa.scrollLeft || esquerda + link.offsetWidth > faixa.scrollLeft + faixa.clientWidth) {
          faixa.scrollLeft = Math.max(0, esquerda - 16);
        }
      }
    }
  }
  let agendado = false;
  window.addEventListener("scroll", () => {
    if (agendado) return;
    agendado = true;
    requestAnimationFrame(() => { agendado = false; atualizarAtiva(); });
  }, { passive: true });

  carregar();
})();
