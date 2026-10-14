/* Formulários de lead ("Tenho interesse" e "Anuncie seu imóvel"), no contrato comum do repositório:
 * validação ao lado do campo, consentimento obrigatório, honeypot, POST {api}/api/leads quando há API e,
 * sem API, mensagem pronta no WhatsApp (ou e-mail). */
(function () {
  "use strict";

  const MZ = window.MarcoZero;
  const M = MZ.config;
  const { h } = MZ;
  const ORIGEM = "imobiliaria";
  const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function preparar(form) {
    const aviso = form.querySelector("[data-aviso-sem-servidor]");
    const erroGeral = form.querySelector("[data-erro-geral]");
    const sucesso = form.querySelector("[data-sucesso]");
    const sucessoTexto = form.querySelector("[data-sucesso-texto]");
    const botao = form.querySelector('[type="submit"]');
    if (aviso) aviso.hidden = Boolean(M.api);

    const erroDe = (campo) => document.getElementById(`${campo.id}-erro`);
    function limparErros() {
      for (const campo of form.querySelectorAll("[aria-invalid]")) { campo.removeAttribute("aria-invalid"); campo.removeAttribute("aria-describedby"); }
      for (const erro of form.querySelectorAll(".campo__erro")) erro.textContent = "";
    }
    function marcarErro(campo, mensagem) {
      const erro = erroDe(campo);
      campo.setAttribute("aria-invalid", "true");
      if (erro) { campo.setAttribute("aria-describedby", erro.id); erro.textContent = mensagem; }
    }
    function validar() {
      limparErros();
      const f = form.elements;
      const erros = [];
      if (f.nome.value.trim().length < 2) erros.push([f.nome, "Diga como podemos te chamar."]);
      const digitos = (f.telefone.value.match(/\d/g) || []).length;
      if (digitos < 10 || digitos > 11) erros.push([f.telefone, "Use DDD e número, por exemplo (00) 00000-0000."]);
      if (f.email && f.email.value.trim() && !EMAIL_VALIDO.test(f.email.value.trim())) erros.push([f.email, "Confira o e-mail: parece incompleto."]);
      if (f.mensagem.value.trim().length < 5) erros.push([f.mensagem, "Conte em uma frase o que você procura."]);
      if (!f.consentimento.checked) erros.push([f.consentimento, "Precisamos da sua autorização para responder."]);
      for (const [campo, mensagem] of erros) marcarErro(campo, mensagem);
      if (erros.length) erros[0][0].focus();
      return erros.length === 0;
    }

    function concluir(texto, urlReabrir, rotulo) {
      sucessoTexto.replaceChildren(texto);
      if (urlReabrir) sucessoTexto.append(" ", h("a", { href: urlReabrir, target: "_blank", rel: "noopener" }, rotulo));
      form.classList.add("lead--enviado");
      sucesso.hidden = false;
      sucesso.focus();
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      erroGeral.textContent = "";
      if (!validar()) return;
      const f = form.elements;

      // honeypot preenchido = robô: finge sucesso e não envia nada
      if (f.site.value) { concluir("Recebemos sua mensagem."); return; }

      const nome = f.nome.value.trim();
      const telefone = f.telefone.value.trim();
      const email = f.email ? f.email.value.trim() : "";
      const mensagem = f.mensagem.value.trim();
      const assunto = [form.dataset.assunto, form.dataset.assuntoExtra].filter(Boolean).join(" ");
      const texto = [
        `*Contato pelo site — ${M.nome}*`,
        `Assunto: ${assunto}`,
        "",
        `Nome: ${nome}`,
        `Telefone: ${telefone}`,
        email ? `E-mail: ${email}` : null,
        "",
        mensagem
      ].filter((linha) => linha !== null).join("\n");
      const urlWhats = M.whatsapp ? `https://wa.me/${M.whatsapp}?text=${encodeURIComponent(texto)}` : "";
      const urlEmail = `mailto:${M.email || ""}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(texto)}`;

      if (M.api) {
        botao.disabled = true;
        try {
          const resposta = await fetch(`${M.api.replace(/\/$/, "")}/api/leads`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              origem: ORIGEM, nome, telefone, email: email || undefined,
              mensagem: `${assunto}\n\n${mensagem}`, consentimento: true, site: ""
            })
          });
          if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
          const corpo = await resposta.json().catch(() => ({}));
          concluir(corpo.protocolo ? `Protocolo ${corpo.protocolo}. Um corretor responde em breve.` : "Um corretor responde em breve.");
        } catch (_) {
          erroGeral.replaceChildren("Não deu para enviar pelo servidor. ",
            h("a", { href: urlWhats || urlEmail, target: "_blank", rel: "noopener" }, urlWhats ? "Enviar pelo WhatsApp" : "Enviar por e-mail"));
        } finally {
          botao.disabled = false;
        }
        return;
      }

      // sem backend: abre o WhatsApp (ou o e-mail) ainda dentro do gesto do usuário
      if (urlWhats) window.open(urlWhats, "_blank", "noopener"); else location.href = urlEmail;
      concluir(
        urlWhats ? "O WhatsApp abriu com a sua mensagem; é só enviar." : "Seu e-mail abriu com a mensagem; é só enviar.",
        urlWhats || urlEmail, urlWhats ? "Abrir o WhatsApp de novo" : "Abrir o e-mail de novo"
      );
    });

    form.reiniciar = () => {
      form.reset();
      limparErros();
      erroGeral.textContent = "";
      form.classList.remove("lead--enviado");
      sucesso.hidden = true;
    };
  }

  document.querySelectorAll("form.lead").forEach(preparar);

  MZ.leads = { reiniciar: (form) => form.reiniciar && form.reiniciar() };
})();
