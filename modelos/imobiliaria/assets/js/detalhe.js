/* Página de detalhe de um imóvel (rota #/imovel/<id>): galeria com teclado, ficha técnica, mapa com um
 * marcador, favorito e formulário "Tenho interesse" pré-preenchido com o código do imóvel. */
(function () {
  "use strict";

  const MZ = window.MarcoZero;
  const { h, svgUse, preco, numero, data, favoritos } = MZ;
  const M = MZ.config;

  const LEGENDAS = {
    "casa-dia": "Fachada", "casa-tarde": "Fachada ao entardecer", "casa-colina": "Fachada com vista",
    "apto-fachada": "Fachada do prédio", "apto-noite": "Prédio à noite",
    "terreno": "Terreno", "terreno-tarde": "Terreno ao entardecer", "terreno-lagoa": "Terreno com a lagoa ao fundo", "rua": "Rua de acesso",
    "comercial": "Fachada da loja", "escritorio": "Escritório", "recepcao": "Recepção",
    "sala": "Sala de estar", "sala-apto": "Sala com varanda", "cozinha": "Cozinha", "quarto": "Quarto",
    "varanda": "Varanda", "piscina": "Piscina", "quintal": "Quintal"
  };
  const FINALIDADES = { venda: "Venda", aluguel: "Aluguel" };

  const $ = (id) => document.getElementById(id);
  const el = {
    secao: $("detalhe"), galeria: $("galeria"), foto: $("galeria-foto"), use: $("galeria-use"),
    anterior: $("galeria-anterior"), proxima: $("galeria-proxima"), status: $("galeria-status"), miniaturas: $("galeria-miniaturas"),
    codigo: $("detalhe-codigo"), finalidade: $("detalhe-finalidade"), titulo: $("detalhe-titulo"), local: $("detalhe-local"),
    atributos: $("detalhe-atributos"), descricao: $("detalhe-descricao"), diferenciais: $("detalhe-diferenciais"), ficha: $("detalhe-ficha"),
    mapa: $("mapa-detalhe"), mapaAviso: $("mapa-detalhe-aviso"),
    preco: $("detalhe-preco"), condominio: $("detalhe-condominio"), favorito: $("detalhe-favorito"),
    form: $("form-interesse")
  };

  let atual = null;
  let fotos = [];
  let indice = 0;
  let mapa = null;
  let marcador = null;

  /* ---------- atributos com ícone (compartilhado com os cards) ---------- */
  function atributos(imovel, completo = false) {
    const itens = [[`${numero(imovel.area)} m²`, "icone-area", completo ? "de área útil" : ""]];
    if (imovel.quartos > 0) itens.push([`${imovel.quartos} ${imovel.quartos === 1 ? "quarto" : "quartos"}`, "icone-quartos", ""]);
    if (completo && imovel.banheiros > 0) itens.push([`${imovel.banheiros} ${imovel.banheiros === 1 ? "banheiro" : "banheiros"}`, "icone-banheiros", ""]);
    if (imovel.vagas > 0) itens.push([`${imovel.vagas} ${imovel.vagas === 1 ? "vaga" : "vagas"}`, "icone-vagas", ""]);
    return itens.map(([texto, icone, sufixo]) =>
      h("li", null, svgUse(icone, { class: "icone", viewBox: "0 0 24 24", "aria-hidden": "true" }), texto, sufixo ? ` ${sufixo}` : "")
    );
  }

  /* ---------- galeria ---------- */
  function mostrarFoto(i) {
    if (!fotos.length) return;
    indice = (i + fotos.length) % fotos.length;
    const id = fotos[indice];
    el.use.setAttribute("href", `#foto-${id}`);
    el.foto.setAttribute("aria-label", `${LEGENDAS[id] || "Foto"} — ${atual.titulo}`);
    el.status.textContent = `Foto ${indice + 1} de ${fotos.length} · ${LEGENDAS[id] || ""}`;
    for (const botao of el.miniaturas.children) {
      if (Number(botao.dataset.indice) === indice) botao.setAttribute("aria-current", "true");
      else botao.removeAttribute("aria-current");
    }
  }
  function renderMiniaturas() {
    el.miniaturas.replaceChildren(...fotos.map((id, i) =>
      h("button", { type: "button", class: "galeria__miniatura", dataset: { indice: i }, "aria-label": `Foto ${i + 1}: ${LEGENDAS[id] || "foto"}` },
        svgUse(`foto-${id}`, { "aria-hidden": "true" }))
    ));
  }
  el.anterior.addEventListener("click", () => mostrarFoto(indice - 1));
  el.proxima.addEventListener("click", () => mostrarFoto(indice + 1));
  el.miniaturas.addEventListener("click", (e) => {
    const botao = e.target.closest("[data-indice]");
    if (botao) mostrarFoto(Number(botao.dataset.indice));
  });
  el.galeria.addEventListener("keydown", (e) => {
    const teclas = { ArrowRight: indice + 1, ArrowLeft: indice - 1, Home: 0, End: fotos.length - 1 };
    if (!(e.key in teclas)) return;
    e.preventDefault();
    mostrarFoto(teclas[e.key]);
    // ao navegar pelas miniaturas com as setas, o foco acompanha a foto escolhida
    if (e.target.closest(".galeria__miniatura")) el.miniaturas.children[indice]?.focus();
  });

  /* ---------- favorito ---------- */
  function atualizarFavorito() {
    if (!atual) return;
    const salvo = favoritos.tem(atual.id);
    el.favorito.setAttribute("aria-pressed", String(salvo));
    el.favorito.querySelector("span").textContent = salvo ? "Salvo nos favoritos" : "Salvar nos favoritos";
  }
  el.favorito.addEventListener("click", () => { if (atual) favoritos.alternar(atual.id); });
  document.addEventListener("favoritos:mudou", atualizarFavorito);

  /* ---------- mapa ---------- */
  function renderMapa(imovel) {
    if (!MZ.mapa.disponivel()) { el.mapaAviso.hidden = false; return; }
    el.mapaAviso.hidden = true;
    if (!mapa) mapa = MZ.mapa.criar(el.mapa, { lat: imovel.lat, lng: imovel.lng, zoom: 15 });
    if (marcador) marcador.remove();
    marcador = MZ.mapa.marcador(imovel, null, true).addTo(mapa);
    // a seção acabou de ficar visível: o Leaflet precisa medir o contêiner de novo
    setTimeout(() => { mapa.invalidateSize(); mapa.setView([imovel.lat, imovel.lng], 15); }, 0);
  }

  /* ---------- ficha ---------- */
  function linhaFicha(rotulo, valor) {
    return valor == null || valor === "" ? null : h("div", null, h("dt", null, rotulo), h("dd", null, valor));
  }

  /** Preenche e exibe o detalhe. `dados` traz os dicionários de bairros e tipos do imoveis.json. */
  function mostrar(imovel, dados) {
    atual = imovel;
    fotos = imovel.fotos || [];
    const aluguel = imovel.finalidade === "aluguel";
    const bairro = dados.bairros[imovel.bairro] || imovel.bairro;
    const tipo = dados.tipos[imovel.tipo] || imovel.tipo;

    el.codigo.textContent = imovel.id;
    el.finalidade.textContent = FINALIDADES[imovel.finalidade] || imovel.finalidade;
    el.titulo.textContent = imovel.titulo;
    el.local.textContent = `${bairro} · ${tipo}`;
    el.atributos.replaceChildren(...atributos(imovel, true));
    el.descricao.textContent = imovel.descricao;
    el.diferenciais.replaceChildren(...(imovel.diferenciais || []).map((d) => h("li", null, d)));
    el.ficha.replaceChildren(...[
      linhaFicha("Código", imovel.id),
      linhaFicha("Tipo", tipo),
      linhaFicha("Finalidade", FINALIDADES[imovel.finalidade]),
      linhaFicha("Bairro", bairro),
      linhaFicha("Área útil", `${numero(imovel.area)} m²`),
      imovel.terreno && imovel.terreno !== imovel.area ? linhaFicha("Terreno", `${numero(imovel.terreno)} m²`) : null,
      imovel.quartos > 0 ? linhaFicha("Quartos", String(imovel.quartos)) : null,
      imovel.banheiros > 0 ? linhaFicha("Banheiros", String(imovel.banheiros)) : null,
      imovel.vagas > 0 ? linhaFicha("Vagas", String(imovel.vagas)) : null,
      imovel.condominio ? linhaFicha("Condomínio", `${preco(imovel.condominio)}/mês`) : null,
      linhaFicha("Publicado em", data(imovel.publicadoEm))
    ].filter(Boolean));

    el.preco.replaceChildren(preco(imovel.preco), aluguel ? h("span", null, " /mês") : "");
    el.condominio.hidden = !imovel.condominio;
    el.condominio.textContent = imovel.condominio ? `+ condomínio ${preco(imovel.condominio)}/mês` : "";
    atualizarFavorito();

    renderMiniaturas();
    mostrarFoto(0);
    renderMapa(imovel);

    MZ.leads.reiniciar(el.form);
    el.form.dataset.assuntoExtra = imovel.id;
    el.form.elements.mensagem.value = `Olá! Tenho interesse no imóvel ${imovel.id} — ${imovel.titulo} (${bairro}). Pode me enviar mais informações e horários para visita?`;

    document.title = `${imovel.titulo} · ${M.nome}`;
  }

  MZ.detalhe = { mostrar, atributos, LEGENDAS };
})();
