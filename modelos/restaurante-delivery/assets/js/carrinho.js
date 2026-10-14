/* Carrinho sem backend: estado em localStorage, painel <dialog> acessível e checkout que monta a mensagem
 * do pedido para o WhatsApp. Quando MODELO.api existe, também registra o pedido em POST {api}/api/leads.
 *
 * Só guarda id, quantidade e observação de cada item; preço e nome vêm sempre do cardápio carregado
 * (cardapio.js chama Carrinho.definirCardapio), então um preço antigo nunca fica preso no navegador. */
(function () {
  "use strict";

  const M = window.MODELO || {};
  const { h, moeda, statusAgora } = window.NonnaRosa;
  const CHAVE = "nonna-rosa.pedido.v1";
  const ORIGEM = "restaurante-delivery";
  const PAGAMENTOS = { pix: "Pix", cartao: "Cartão na entrega", dinheiro: "Dinheiro" };

  const $ = (id) => document.getElementById(id);
  const dialog = $("carrinho");
  const el = {
    abrir: $("abrir-carrinho"), badge: $("carrinho-badge"), live: $("carrinho-live"),
    barra: $("barra-pedido"), barraQtd: $("barra-qtd"), barraTotal: $("barra-total"),
    fechar: $("carrinho-fechar"), itens: $("carrinho-itens"), vazio: $("carrinho-vazio"), modo: $("modo"),
    subtotal: $("resumo-subtotal"), taxaRotulo: $("resumo-taxa-rotulo"), taxa: $("resumo-taxa"), total: $("resumo-total"),
    avisoMinimo: $("aviso-minimo"), continuar: $("continuar"),
    form: $("checkout"), voltar: $("voltar-itens"), avisoSemServidor: $("aviso-sem-servidor"),
    grupoEndereco: $("grupo-endereco"), grupoTroco: $("grupo-troco"), checkoutTotal: $("checkout-total"),
    erroGeral: $("erro-geral"), enviar: $("enviar"),
    sucessoTitulo: $("sucesso-titulo"), sucessoTexto: $("sucesso-texto"), sucessoProtocolo: $("sucesso-protocolo"),
    sucessoLink: $("sucesso-link"), sucessoFechar: $("sucesso-fechar"),
    toast: $("toast")
  };
  const etapas = {
    itens: dialog.querySelector('[data-etapa="itens"]'),
    checkout: el.form,
    sucesso: dialog.querySelector('[data-etapa="sucesso"]')
  };

  let cardapio = new Map();   // id -> item do cardápio
  let pronto = false;         // cardápio já carregado?
  let estado = carregar();    // { itens: [{ id, qtd, obs }], modo: "entrega" | "retirada" }
  let focoAnterior = null;

  /* ---------- persistência ---------- */
  function carregar() {
    try {
      const salvo = JSON.parse(localStorage.getItem(CHAVE));
      if (salvo && Array.isArray(salvo.itens)) {
        return {
          itens: salvo.itens.filter((i) => i && typeof i.id === "string" && i.qtd > 0)
            .map((i) => ({ id: i.id, qtd: Math.min(99, Math.floor(i.qtd)), obs: String(i.obs || "").slice(0, 120) })),
          modo: salvo.modo === "retirada" ? "retirada" : "entrega"
        };
      }
    } catch (_) { /* localStorage indisponível ou corrompido: começa vazio */ }
    return { itens: [], modo: "entrega" };
  }
  function salvar() {
    try { localStorage.setItem(CHAVE, JSON.stringify(estado)); } catch (_) { /* modo privado etc. */ }
  }

  /* ---------- cálculos ---------- */
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
  const quantidade = () => estado.itens.reduce((soma, i) => soma + i.qtd, 0);
  function totais() {
    const subtotal = estado.itens.reduce((soma, i) => soma + (cardapio.get(i.id)?.preco || 0) * i.qtd, 0);
    const taxa = estado.modo === "entrega" && estado.itens.length ? (M.entrega?.taxa || 0) : 0;
    return { subtotal, taxa, total: subtotal + taxa };
  }

  /* ---------- atualização da interface ---------- */
  function atualizar() {
    const qtd = quantidade();
    const t = totais();
    el.badge.hidden = qtd === 0;
    el.badge.textContent = String(qtd);
    el.abrir.setAttribute("aria-label", qtd ? `Abrir o pedido: ${plural(qtd, "item", "itens")}` : "Abrir o pedido (vazio)");
    el.live.textContent = qtd ? `${plural(qtd, "item", "itens")} no pedido` : "Pedido vazio";
    el.barra.hidden = qtd === 0 || !pronto;
    el.barraQtd.textContent = plural(qtd, "item", "itens");
    el.barraTotal.textContent = moeda(t.total);
    renderResumo(t);
    document.dispatchEvent(new CustomEvent("carrinho:mudou", {
      detail: { quantidades: Object.fromEntries(estado.itens.map((i) => [i.id, i.qtd])) }
    }));
  }

  function renderResumo(t) {
    const minimo = M.entrega?.pedidoMinimo || 0;
    const entrega = estado.modo === "entrega";
    el.subtotal.textContent = moeda(t.subtotal);
    el.taxaRotulo.textContent = entrega ? "Entrega" : "Retirada";
    el.taxa.textContent = entrega ? (t.taxa ? moeda(t.taxa) : "Grátis") : "Sem taxa";
    el.total.textContent = moeda(t.total);
    el.checkoutTotal.textContent = moeda(t.total);

    const abaixoDoMinimo = entrega && estado.itens.length > 0 && t.subtotal < minimo;
    let aviso = "";
    if (abaixoDoMinimo) aviso = `Pedido mínimo para entrega: ${moeda(minimo)}. Faltam ${moeda(minimo - t.subtotal)} — ou escolha retirada.`;
    else if (estado.itens.length && !statusAgora().aberto) aviso = "A cantina está fechada agora. Você pode montar o pedido; a confirmação sai quando abrirmos.";
    el.avisoMinimo.hidden = !aviso;
    el.avisoMinimo.textContent = aviso;
    el.avisoMinimo.classList.toggle("carrinho__aviso--info", Boolean(aviso) && !abaixoDoMinimo);
    el.continuar.disabled = estado.itens.length === 0 || abaixoDoMinimo;
  }

  function renderItens(focoId, focoAcao) {
    const lista = estado.itens.filter((i) => cardapio.has(i.id));
    el.vazio.hidden = lista.length > 0;
    el.modo.hidden = lista.length === 0;
    el.itens.replaceChildren(...lista.map((item) => {
      const prato = cardapio.get(item.id);
      return h("li", { class: "pedido-item", dataset: { id: item.id } },
        h("div", { class: "pedido-item__cabeca" },
          h("span", { class: "pedido-item__nome" }, prato.nome),
          h("span", { class: "pontos", "aria-hidden": "true" }),
          h("span", { class: "pedido-item__preco" }, moeda(prato.preco * item.qtd))),
        h("div", { class: "pedido-item__controles" },
          h("div", { class: "qtd", role: "group", "aria-label": `Quantidade de ${prato.nome}` },
            h("button", { type: "button", "data-acao": "menos", "aria-label": `Diminuir ${prato.nome}`, disabled: item.qtd <= 1 }, "−"),
            h("output", null, String(item.qtd)),
            h("button", { type: "button", "data-acao": "mais", "aria-label": `Aumentar ${prato.nome}`, disabled: item.qtd >= 99 }, "+")),
          h("button", { type: "button", class: "link-botao pedido-item__remover", "data-acao": "remover" }, "Remover")),
        h("label", { class: "pedido-item__obs" },
          h("span", { class: "sr-only" }, `Observação para ${prato.nome}`),
          h("input", { type: "text", maxlength: "120", placeholder: "Observação (ex.: sem cebola)", value: item.obs || "", "data-acao": "obs" }))
      );
    }));
    if (focoId) {
      const alvo = el.itens.querySelector(`[data-id="${CSS.escape(focoId)}"] [data-acao="${focoAcao}"]`);
      if (alvo && !alvo.disabled) alvo.focus();
      else el.itens.querySelector(`[data-id="${CSS.escape(focoId)}"] [data-acao="remover"]`)?.focus();
    }
  }

  function mostrarEtapa(nome) {
    for (const [chave, etapa] of Object.entries(etapas)) etapa.hidden = chave !== nome;
    etapas[nome].querySelector(".carrinho__corpo").scrollTop = 0;
  }

  let toastTimer = 0;
  function toast(mensagem) {
    el.toast.textContent = mensagem;
    el.toast.classList.add("is-visivel");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove("is-visivel"), 2200);
  }

  /* ---------- operações ---------- */
  function adicionar(id) {
    const prato = cardapio.get(id);
    if (!prato || prato.disponivel === false) return;
    const existente = estado.itens.find((i) => i.id === id);
    if (existente) existente.qtd = Math.min(99, existente.qtd + 1);
    else estado.itens.push({ id, qtd: 1, obs: "" });
    salvar();
    atualizar();
    if (dialog.open) renderItens();
    toast(`${prato.nome} adicionado ao pedido`);
  }

  function alterarQuantidade(id, delta) {
    const item = estado.itens.find((i) => i.id === id);
    if (!item) return;
    item.qtd = Math.max(1, Math.min(99, item.qtd + delta));
    salvar();
    atualizar();
    renderItens(id, delta > 0 ? "mais" : "menos");
  }

  function remover(id) {
    const indice = estado.itens.findIndex((i) => i.id === id);
    if (indice < 0) return;
    const nome = cardapio.get(id)?.nome || "Item";
    estado.itens.splice(indice, 1);
    salvar();
    atualizar();
    renderItens();
    const proximo = estado.itens[indice] || estado.itens[indice - 1];
    if (proximo) renderItens(proximo.id, "remover");
    else el.fechar.focus();
    toast(`${nome} removido`);
  }

  /* ---------- abrir / fechar ---------- */
  function abrir() {
    if (dialog.open) return;
    focoAnterior = document.activeElement;
    renderItens();
    mostrarEtapa("itens");
    dialog.showModal();
  }
  el.abrir.addEventListener("click", abrir);
  el.barra.addEventListener("click", abrir);
  el.fechar.addEventListener("click", () => dialog.close());
  el.sucessoFechar.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); }); // clique no fundo escurecido
  dialog.addEventListener("close", () => {
    if (etapas.sucesso.hidden === false) { el.form.reset(); mostrarEtapa("itens"); }
    (focoAnterior && focoAnterior.isConnected && !focoAnterior.hidden ? focoAnterior : el.abrir).focus();
  });

  /* ---------- itens: delegação de eventos ---------- */
  el.itens.addEventListener("click", (e) => {
    const botao = e.target.closest("[data-acao]");
    if (!botao) return;
    const id = botao.closest("[data-id]").dataset.id;
    if (botao.dataset.acao === "mais") alterarQuantidade(id, +1);
    else if (botao.dataset.acao === "menos") alterarQuantidade(id, -1);
    else if (botao.dataset.acao === "remover") remover(id);
  });
  el.itens.addEventListener("input", (e) => {
    if (e.target.dataset.acao !== "obs") return;
    const item = estado.itens.find((i) => i.id === e.target.closest("[data-id]").dataset.id);
    if (item) { item.obs = e.target.value.slice(0, 120); salvar(); }
  });

  el.modo.querySelector(`input[value="${estado.modo}"]`).checked = true;
  el.modo.addEventListener("change", (e) => {
    if (e.target.name !== "modo") return;
    estado.modo = e.target.value === "retirada" ? "retirada" : "entrega";
    salvar();
    atualizar();
  });

  /* ---------- checkout ---------- */
  el.continuar.addEventListener("click", () => {
    el.grupoEndereco.hidden = estado.modo !== "entrega";
    el.avisoSemServidor.hidden = Boolean(M.api);
    limparErros();
    mostrarEtapa("checkout");
    el.form.elements.nome.focus();
  });
  el.voltar.addEventListener("click", () => { mostrarEtapa("itens"); el.continuar.focus(); });
  el.form.addEventListener("change", (e) => {
    if (e.target.name === "pagamento") el.grupoTroco.hidden = e.target.value !== "dinheiro";
  });

  function limparErros() {
    for (const campo of el.form.querySelectorAll("[aria-invalid]")) { campo.removeAttribute("aria-invalid"); campo.removeAttribute("aria-describedby"); }
    for (const erro of el.form.querySelectorAll(".campo__erro")) erro.textContent = "";
  }
  function marcarErro(campo, mensagem) {
    const erro = $(`erro-${campo.id}`);
    campo.setAttribute("aria-invalid", "true");
    if (erro) { campo.setAttribute("aria-describedby", erro.id); erro.textContent = mensagem; }
  }
  const lerNumero = (texto) => {
    const limpo = String(texto).replace(/[^\d,.]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
    return limpo ? Number(limpo) : NaN;
  };

  function validar() {
    limparErros();
    const f = el.form.elements;
    const erros = [];
    if (f.nome.value.trim().length < 2) erros.push([f.nome, "Diga como podemos te chamar."]);
    const digitos = (f.telefone.value.match(/\d/g) || []).length;
    if (digitos < 10 || digitos > 11) erros.push([f.telefone, "Use DDD e número, por exemplo (00) 00000-0000."]);
    if (estado.modo === "entrega") {
      if (f.endereco.value.trim().length < 5) erros.push([f.endereco, "Precisamos da rua e do número para entregar."]);
      if (f.bairro.value.trim().length < 2) erros.push([f.bairro, "Informe o bairro."]);
    }
    if (f.pagamento.value === "dinheiro" && f.troco.value.trim()) {
      const valor = lerNumero(f.troco.value);
      const { total } = totais();
      if (Number.isNaN(valor)) erros.push([f.troco, "Digite só o valor, por exemplo 100."]);
      else if (valor < total) erros.push([f.troco, `O troco precisa ser para um valor acima do total (${moeda(total)}).`]);
    }
    if (!f.consentimento.checked) erros.push([f.consentimento, "Precisamos da sua autorização para usar os dados do pedido."]);
    for (const [campo, mensagem] of erros) marcarErro(campo, mensagem);
    if (erros.length) erros[0][0].focus();
    return erros.length === 0;
  }

  function montarMensagem(f) {
    const t = totais();
    const linhas = [`*Pedido — ${M.nome}*`, ""];
    for (const item of estado.itens) {
      const prato = cardapio.get(item.id);
      if (!prato) continue;
      linhas.push(`${item.qtd}× ${prato.nome} — ${moeda(prato.preco * item.qtd)}`);
      if (item.obs) linhas.push(`   Obs.: ${item.obs}`);
    }
    linhas.push("", `Subtotal: ${moeda(t.subtotal)}`);
    linhas.push(estado.modo === "entrega" ? `Taxa de entrega: ${moeda(t.taxa)}` : "Retirada no balcão: sem taxa");
    linhas.push(`*Total: ${moeda(t.total)}*`, "");
    if (estado.modo === "entrega") {
      const referencia = f.referencia.value.trim();
      linhas.push(`Entregar em: ${f.endereco.value.trim()}, ${f.bairro.value.trim()}${referencia ? ` (${referencia})` : ""}`);
    } else {
      linhas.push("Vou retirar na cantina");
    }
    let pagamento = PAGAMENTOS[f.pagamento.value] || f.pagamento.value;
    if (f.pagamento.value === "dinheiro") {
      const troco = lerNumero(f.troco.value);
      pagamento += Number.isNaN(troco) ? " (sem troco)" : ` (troco para ${moeda(troco)})`;
    }
    linhas.push(`Pagamento: ${pagamento}`);
    if (f.observacao.value.trim()) linhas.push(`Observação: ${f.observacao.value.trim()}`);
    linhas.push("", `Nome: ${f.nome.value.trim()}`, `Telefone: ${f.telefone.value.trim()}`);
    return linhas.join("\n");
  }

  el.form.addEventListener("submit", async (e) => {
    e.preventDefault();
    el.erroGeral.textContent = "";
    if (!validar()) return;
    const f = el.form.elements;

    // honeypot preenchido = robô: finge sucesso e não abre nada
    if (f.site.value) { concluir("", null, ""); return; }

    const texto = montarMensagem(f);
    const urlWhats = M.whatsapp ? `https://wa.me/${M.whatsapp}?text=${encodeURIComponent(texto)}` : "";
    const urlEmail = `mailto:${M.email || ""}?subject=${encodeURIComponent(`Pedido — ${M.nome}`)}&body=${encodeURIComponent(texto)}`;

    // abre o WhatsApp ainda dentro do gesto do usuário (antes de qualquer await) para não cair no bloqueio de pop-up
    if (urlWhats) window.open(urlWhats, "_blank", "noopener");
    else location.href = urlEmail;

    let protocolo = null;
    let aviso = "";
    if (M.api) {
      el.enviar.disabled = true;
      try {
        const resposta = await fetch(`${M.api.replace(/\/$/, "")}/api/leads`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            origem: ORIGEM,
            nome: f.nome.value.trim(),
            telefone: f.telefone.value.trim(),
            mensagem: texto,
            consentimento: true,
            site: ""
          })
        });
        if (resposta.ok) {
          const corpo = await resposta.json().catch(() => ({}));
          protocolo = corpo.protocolo || corpo.id || null;
        } else {
          aviso = "O servidor não registrou o pedido, mas ele seguiu pelo WhatsApp.";
        }
      } catch (_) {
        aviso = "Não deu para falar com o servidor, mas o pedido seguiu pelo WhatsApp.";
      } finally {
        el.enviar.disabled = false;
      }
    }
    concluir(urlWhats || urlEmail, protocolo, aviso, Boolean(urlWhats));
  });

  function concluir(urlReabrir, protocolo, aviso, foiWhats = true) {
    estado.itens = [];
    salvar();
    atualizar();
    el.sucessoTexto.textContent = (foiWhats
      ? "O WhatsApp abriu com a mensagem do pedido. É só enviar para a cantina confirmar."
      : "Seu aplicativo de e-mail abriu com a mensagem do pedido. É só enviar para a cantina confirmar.") + (aviso ? ` ${aviso}` : "");
    el.sucessoProtocolo.hidden = !protocolo;
    el.sucessoProtocolo.textContent = protocolo ? `Protocolo: ${protocolo}` : "";
    el.sucessoLink.hidden = !urlReabrir;
    el.sucessoLink.href = urlReabrir || "#";
    el.sucessoLink.textContent = foiWhats ? "Abrir o WhatsApp de novo" : "Abrir o e-mail de novo";
    mostrarEtapa("sucesso");
    el.sucessoTitulo.focus();
  }

  /* ---------- API usada pelo cardapio.js ---------- */
  window.Carrinho = {
    adicionar,
    definirCardapio(itens) {
      cardapio = new Map(itens.map((i) => [i.id, i]));
      const antes = estado.itens.length;
      estado.itens = estado.itens.filter((i) => cardapio.has(i.id) && cardapio.get(i.id).disponivel !== false);
      if (estado.itens.length !== antes) salvar();
      pronto = true;
      atualizar();
      if (dialog.open) renderItens();
    }
  };

  atualizar();
})();
