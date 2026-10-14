// Formulário de contato: validação ao lado do campo, honeypot, POST {api}/api/leads ou, sem API, WhatsApp/mailto.
(function () {
  "use strict";
  const form = document.getElementById("form-contato");
  if (!form) return;

  const M = window.MODELO || {};
  const semApi = !M.api;
  const digitos = (s) => String(s || "").replace(/\D/g, "");
  const campos = form.elements;
  const avisoSemApi = form.querySelector("[data-aviso-sem-api]");
  const erroGeral = form.querySelector("[data-form-erro]");
  const botao = form.querySelector('[type="submit"]');
  const painelSucesso = document.querySelector("[data-sucesso]");
  const AREAS = {
    civel: "Direito Cível", trabalhista: "Direito do Trabalho", familia: "Família e Sucessões",
    consumidor: "Direito do Consumidor", empresarial: "Direito Empresarial", previdenciario: "Direito Previdenciário",
    outra: "Não sei / outra"
  };

  if (semApi && avisoSemApi) avisoSemApi.hidden = false;

  // ?area=civel (vindo da página de áreas) pré-seleciona a área
  const areaUrl = new URLSearchParams(location.search).get("area");
  if (areaUrl && AREAS[areaUrl]) campos.area.value = areaUrl;

  // máscara leve: (00) 00000-0000
  campos.telefone.addEventListener("input", () => {
    const d = digitos(campos.telefone.value).slice(0, 11);
    let v = d;
    if (d.length > 2) v = "(" + d.slice(0, 2) + ") " + d.slice(2);
    if (d.length > 7) v = "(" + d.slice(0, 2) + ") " + d.slice(2, d.length === 11 ? 7 : 6) + "-" + d.slice(d.length === 11 ? 7 : 6);
    campos.telefone.value = v;
  });

  const regras = {
    nome: (el) => el.value.trim().length >= 3 || "Informe seu nome completo.",
    telefone: (el) => /^\d{10,11}$/.test(digitos(el.value)) || "Informe um telefone com DDD, como (00) 00000-0000.",
    email: (el) => !el.value.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value) || "Confira o e-mail: parece incompleto.",
    area: (el) => !!el.value || "Escolha a área mais próxima do seu caso (ou \"Não sei\").",
    mensagem: (el) => el.value.trim().length >= 20 || "Conte em pelo menos duas frases o que aconteceu.",
    consentimento: (el) => el.checked || "Precisamos da sua autorização para retornar o contato."
  };

  function validar(nome) {
    const el = campos[nome];
    const erro = document.getElementById("erro-" + nome);
    const resultado = regras[nome](el);
    const ok = resultado === true;
    el.setAttribute("aria-invalid", ok ? "false" : "true");
    if (erro) erro.textContent = ok ? "" : resultado;
    return ok;
  }

  Object.keys(regras).forEach((nome) => {
    const el = campos[nome];
    el.addEventListener("blur", () => validar(nome));
    el.addEventListener("input", () => { if (el.getAttribute("aria-invalid") === "true") validar(nome); });
  });

  function montarMensagem(d) {
    return [
      "Olá! Gostaria de agendar uma consulta.",
      "Nome: " + d.nome,
      "Telefone: " + d.telefone,
      d.email ? "E-mail: " + d.email : "",
      "Área: " + AREAS[d.area],
      "Resumo: " + d.mensagem
    ].filter(Boolean).join("\n");
  }

  function mostrarSucesso(texto, link) {
    form.hidden = true;
    painelSucesso.querySelector("[data-sucesso-texto]").textContent = texto;
    const a = painelSucesso.querySelector("[data-sucesso-link]");
    if (link) { a.href = link.href; a.textContent = link.rotulo; a.hidden = false; } else { a.hidden = true; }
    painelSucesso.hidden = false;
    painelSucesso.focus();
  }

  function abrirEmNovaAba(url) {
    const a = document.createElement("a");
    a.href = url; a.target = "_blank"; a.rel = "noopener";
    document.body.appendChild(a); a.click(); a.remove();
  }

  async function enviarPelaApi(dados) {
    const resposta = await fetch(M.api.replace(/\/$/, "") + "/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        origem: "advocacia",
        nome: dados.nome, telefone: dados.telefone, email: dados.email || undefined,
        mensagem: "Área: " + AREAS[dados.area] + "\n" + dados.mensagem,
        consentimento: true, site: ""
      })
    });
    if (!resposta.ok) throw new Error("HTTP " + resposta.status);
    const corpo = await resposta.json().catch(() => ({}));
    mostrarSucesso(corpo.protocolo
      ? "Protocolo " + corpo.protocolo + ". Retornamos em horário comercial pelo telefone informado."
      : "Retornamos em horário comercial pelo telefone informado.");
  }

  function enviarSemApi(dados) {
    const texto = montarMensagem(dados);
    const wa = digitos(M.whatsapp);
    if (wa) {
      const url = "https://wa.me/" + wa + "?text=" + encodeURIComponent(texto);
      abrirEmNovaAba(url);
      mostrarSucesso("Sua mensagem foi aberta no WhatsApp. Se a janela não apareceu, use o botão abaixo.",
        { href: url, rotulo: "Abrir WhatsApp" });
    } else {
      const url = "mailto:" + (M.email || "contato@exemplo.com.br") + "?subject=" + encodeURIComponent("Consulta - " + dados.nome) +
        "&body=" + encodeURIComponent(texto);
      location.href = url;
      mostrarSucesso("Sua mensagem foi aberta no seu aplicativo de e-mail.", { href: url, rotulo: "Abrir e-mail" });
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    erroGeral.hidden = true;
    const invalidos = Object.keys(regras).filter((nome) => !validar(nome));
    if (invalidos.length) { campos[invalidos[0]].focus(); return; }

    const dados = {
      nome: campos.nome.value.trim(), telefone: campos.telefone.value.trim(), email: campos.email.value.trim(),
      area: campos.area.value, mensagem: campos.mensagem.value.trim()
    };
    if (campos.site.value) { mostrarSucesso("Retornamos em horário comercial."); return; } // honeypot: finge sucesso

    botao.disabled = true;
    const rotulo = botao.textContent;
    botao.textContent = "Enviando…";
    try {
      if (semApi) enviarSemApi(dados); else await enviarPelaApi(dados);
    } catch (err) {
      erroGeral.textContent = "Não foi possível enviar agora. Tente de novo em instantes ou fale conosco pelo telefone.";
      erroGeral.hidden = false;
    } finally {
      botao.disabled = false;
      botao.textContent = rotulo;
    }
  });
})();
