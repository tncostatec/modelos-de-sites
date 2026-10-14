// Formulário "Orçamento em 60 segundos": 3 etapas, validação por etapa, rascunho em sessionStorage,
// honeypot + time-trap, envio POST {api}/api/leads ou, sem API, WhatsApp/mailto.
(function () {
  "use strict";
  const form = document.getElementById("form-orcamento");
  if (!form) return;

  const M = window.MODELO || {};
  const semApi = !M.api;
  const CHAVE = "prumo.orcamento";
  const TEMPO_MINIMO = 3000;                // time-trap: envio em menos de 3 s desde o carregamento é rejeitado
  const carregadoEm = Date.now();
  const digitos = (s) => String(s || "").replace(/\D/g, "");
  const campos = form.elements;
  const etapas = Array.from(form.querySelectorAll("fieldset[data-etapa]"));
  const TOTAL = etapas.length;
  const NOMES = ["O que você precisa?", "Conte um pouco mais", "Como falamos com você?"];
  const progresso = form.querySelector('[role="progressbar"]');
  const barra = form.querySelector(".progresso-barra");
  const rotuloEtapa = form.querySelector("[data-etapa-atual]");
  const rotuloNome = form.querySelector("[data-etapa-nome]");
  const btVoltar = form.querySelector("[data-voltar]");
  const btAvancar = form.querySelector("[data-avancar]");
  const btEnviar = form.querySelector("[data-enviar]");
  const erroGeral = form.querySelector("[data-form-erro]");
  const avisoSemApi = form.querySelector("[data-aviso-sem-api]");
  const painel = document.querySelector("[data-sucesso]");
  const movimentoReduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let atual = 1;

  if (semApi && avisoSemApi) avisoSemApi.hidden = false;

  // ---------- leitura e rascunho ----------
  const marcado = (nome) => { const r = form.querySelector('input[name="' + nome + '"]:checked'); return r ? r.value : ""; };
  const dados = () => ({
    servico: marcado("servico"), urgencia: marcado("urgencia"),
    descricao: campos.descricao.value.trim(), bairro: campos.bairro.value.trim(),
    nome: campos.nome.value.trim(), telefone: campos.telefone.value.trim(),
    consentimento: campos.consentimento.checked
  });
  function salvar() {
    try { sessionStorage.setItem(CHAVE, JSON.stringify({ etapa: atual, valores: dados() })); } catch (e) { /* armazenamento indisponível */ }
  }
  function restaurar() {
    try {
      const r = JSON.parse(sessionStorage.getItem(CHAVE) || "null");
      if (!r || !r.valores) return 1;
      const v = r.valores;
      form.querySelectorAll('input[name="servico"]').forEach((i) => { i.checked = i.value === v.servico; });
      form.querySelectorAll('input[name="urgencia"]').forEach((i) => { i.checked = i.value === v.urgencia; });
      campos.descricao.value = v.descricao || "";
      campos.bairro.value = v.bairro || "";
      campos.nome.value = v.nome || "";
      campos.telefone.value = v.telefone || "";
      // o consentimento LGPD não é restaurado: precisa ser marcado de novo, de propósito
      return Math.min(Math.max(Number(r.etapa) || 1, 1), TOTAL);
    } catch (e) { return 1; }
  }
  function limparRascunho() { try { sessionStorage.removeItem(CHAVE); } catch (e) { /* ignora */ } }

  // ---------- navegação entre etapas ----------
  function mostrar(n, focar) {
    atual = n;
    etapas.forEach((f) => { f.hidden = Number(f.dataset.etapa) !== n; });
    progresso.setAttribute("aria-valuenow", String(n));
    progresso.setAttribute("aria-valuetext", "Etapa " + n + " de " + TOTAL);
    barra.style.setProperty("--p", (n / TOTAL) * 100 + "%");
    rotuloEtapa.textContent = "Etapa " + n + " de " + TOTAL;
    rotuloNome.textContent = NOMES[n - 1];
    btVoltar.hidden = n === 1;
    btAvancar.hidden = n === TOTAL;
    btEnviar.hidden = n !== TOTAL;
    erroGeral.hidden = true;
    if (focar) {
      const legenda = etapas[n - 1].querySelector("legend");
      legenda.setAttribute("tabindex", "-1");
      legenda.focus({ preventScroll: true });
    }
    salvar();
  }

  // ---------- validação ----------
  const regras = {
    servico: () => !!marcado("servico") || "Escolha o tipo de serviço.",
    urgencia: () => !!marcado("urgencia") || "Diga para quando você precisa.",
    descricao: () => campos.descricao.value.trim().length >= 10 || "Descreva em uma frase o que está acontecendo.",
    bairro: () => campos.bairro.value.trim().length >= 2 || "Informe o bairro.",
    nome: () => campos.nome.value.trim().length >= 3 || "Informe seu nome.",
    telefone: () => /^\d{10,11}$/.test(digitos(campos.telefone.value)) || "Informe um telefone com DDD, como (00) 00000-0000.",
    consentimento: () => campos.consentimento.checked || "Precisamos da sua autorização para entrar em contato."
  };
  const POR_ETAPA = { 1: ["servico"], 2: ["urgencia", "descricao", "bairro"], 3: ["nome", "telefone", "consentimento"] };

  function validarCampo(nome) {
    const resultado = regras[nome]();
    const ok = resultado === true;
    document.getElementById("erro-" + nome).textContent = ok ? "" : resultado;
    const grupo = form.querySelector('[data-grupo="' + nome + '"]');
    if (grupo) grupo.toggleAttribute("data-invalido", !ok);
    else campos[nome].setAttribute("aria-invalid", ok ? "false" : "true");
    return ok;
  }
  function focar(nome) {
    const grupo = form.querySelector('[data-grupo="' + nome + '"]');
    (grupo ? grupo.querySelector("input") : campos[nome]).focus();
  }
  function validarEtapa(n) {
    const invalidos = POR_ETAPA[n].filter((nome) => !validarCampo(nome));
    if (invalidos.length) focar(invalidos[0]);
    return invalidos.length === 0;
  }

  // revalida ao digitar/mudar um campo que já estava com erro; salva o rascunho a cada mudança
  form.addEventListener("input", (e) => {
    const nome = e.target.name;
    if (nome in regras && document.getElementById("erro-" + nome).textContent) validarCampo(nome);
    salvar();
  });
  form.addEventListener("change", (e) => {
    const nome = e.target.name;
    if (nome in regras && document.getElementById("erro-" + nome).textContent) validarCampo(nome);
    salvar();
  });

  // máscara leve: (00) 00000-0000
  campos.telefone.addEventListener("input", () => {
    const d = digitos(campos.telefone.value).slice(0, 11);
    let v = d;
    if (d.length > 2) v = "(" + d.slice(0, 2) + ") " + d.slice(2);
    if (d.length > 7) { const corte = d.length === 11 ? 7 : 6; v = "(" + d.slice(0, 2) + ") " + d.slice(2, corte) + "-" + d.slice(corte); }
    campos.telefone.value = v;
  });

  btAvancar.addEventListener("click", () => { if (validarEtapa(atual)) mostrar(atual + 1, true); });
  btVoltar.addEventListener("click", () => mostrar(atual - 1, true));

  // Enter num campo de texto avança a etapa em vez de enviar o formulário incompleto
  form.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && atual < TOTAL && e.target.tagName !== "TEXTAREA" && e.target.type !== "submit") {
      e.preventDefault();
      btAvancar.click();
    }
  });

  // ---------- envio ----------
  function montarMensagem(d) {
    return [
      "Olá, Prumo! Quero um orçamento.",
      "Serviço: " + d.servico,
      "Para quando: " + d.urgencia,
      "O que está acontecendo: " + d.descricao,
      "Bairro: " + d.bairro,
      "Nome: " + d.nome,
      "Telefone: " + d.telefone
    ].join("\n");
  }
  function mostrarErro(texto) {
    erroGeral.textContent = texto;
    erroGeral.hidden = false;
  }
  function mostrarSucesso(texto, link) {
    form.hidden = true;
    painel.querySelector("[data-sucesso-texto]").textContent = texto;
    const a = painel.querySelector("[data-sucesso-link]");
    if (link) { a.href = link.href; a.textContent = link.rotulo; a.hidden = false; } else { a.hidden = true; }
    painel.hidden = false;
    painel.focus();
    limparRascunho();
  }
  function abrirEmNovaAba(url) {
    const a = document.createElement("a");
    a.href = url; a.target = "_blank"; a.rel = "noopener";
    document.body.appendChild(a); a.click(); a.remove();
  }
  async function enviarPelaApi(d, mensagem) {
    const resposta = await fetch(M.api.replace(/\/$/, "") + "/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origem: "servicos-residenciais", nome: d.nome, telefone: d.telefone, mensagem: mensagem, consentimento: true, site: "" })
    });
    if (!resposta.ok) throw new Error("HTTP " + resposta.status);
    const corpo = await resposta.json().catch(() => ({}));
    mostrarSucesso(corpo.protocolo
      ? "Pedido nº " + corpo.protocolo + " recebido. Entramos em contato pelo telefone informado em horário comercial."
      : "Entramos em contato pelo telefone informado em horário comercial.");
  }
  function enviarSemApi(d, mensagem) {
    const wa = digitos(M.whatsapp);
    if (wa) {
      const url = "https://wa.me/" + wa + "?text=" + encodeURIComponent(mensagem);
      abrirEmNovaAba(url);
      mostrarSucesso("Abrimos o WhatsApp com o seu pedido pronto para enviar. Se a janela não apareceu, toque no botão.", { href: url, rotulo: "Abrir WhatsApp" });
    } else {
      const url = "mailto:" + (M.email || "contato@exemplo.com.br") + "?subject=" + encodeURIComponent("Orçamento - " + d.servico) + "&body=" + encodeURIComponent(mensagem);
      location.href = url;
      mostrarSucesso("Seu pedido foi aberto no aplicativo de e-mail.", { href: url, rotulo: "Abrir e-mail" });
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    erroGeral.hidden = true;
    if (!validarEtapa(TOTAL)) return;
    if (Date.now() - carregadoEm < TEMPO_MINIMO) {
      mostrarErro("Opa, foi rápido demais. Para evitar envios automáticos, aguarde alguns segundos e toque em \"Enviar pedido\" de novo.");
      return;
    }
    const d = dados();
    if (campos.site.value) { mostrarSucesso("Entramos em contato em horário comercial."); return; } // honeypot: finge sucesso

    const mensagem = montarMensagem(d);
    btEnviar.disabled = true;
    const rotulo = btEnviar.textContent;
    btEnviar.textContent = "Enviando…";
    try {
      if (semApi) enviarSemApi(d, mensagem); else await enviarPelaApi(d, mensagem);
    } catch (err) {
      mostrarErro("Não foi possível enviar agora. Tente de novo em instantes ou chame no WhatsApp pelo botão abaixo.");
    } finally {
      btEnviar.disabled = false;
      btEnviar.textContent = rotulo;
    }
  });

  // "Fazer outro pedido"
  painel.querySelector("[data-novo]").addEventListener("click", () => {
    form.reset();
    form.querySelectorAll("[aria-invalid]").forEach((el) => el.removeAttribute("aria-invalid"));
    form.querySelectorAll("[data-invalido]").forEach((el) => el.removeAttribute("data-invalido"));
    form.querySelectorAll(".campo-erro").forEach((el) => { el.textContent = ""; });
    painel.hidden = true;
    form.hidden = false;
    mostrar(1, true);
  });

  // botões "Pedir orçamento" dos cartões de serviço: pré-selecionam o serviço e levam ao formulário
  document.querySelectorAll("[data-escolher]").forEach((botao) => {
    botao.addEventListener("click", () => {
      const valor = botao.getAttribute("data-escolher");
      form.querySelectorAll('input[name="servico"]').forEach((i) => { i.checked = i.value === valor; });
      if (painel && !painel.hidden) painel.querySelector("[data-novo]").click();
      mostrar(1, false);
      document.getElementById("orcamento").scrollIntoView({ behavior: movimentoReduzido ? "auto" : "smooth", block: "start" });
      const escolhido = form.querySelector('input[name="servico"]:checked');
      if (escolhido) escolhido.focus({ preventScroll: true });
    });
  });

  mostrar(restaurar(), false);
})();
