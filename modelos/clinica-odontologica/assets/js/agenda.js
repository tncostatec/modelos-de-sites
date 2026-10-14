/* Agendamento em <dialog> nativo.
   - Abre pelos botões [data-abrir-agenda]; fecha por [data-fechar-agenda], Esc (nativo) ou clique no fundo.
   - Com MODELO.api: horários vêm de GET {api}/api/agenda/slots?data=&servico= e o envio é POST {api}/api/agenda.
   - Sem api (GitHub Pages): campo de hora livre, e o envio abre o WhatsApp com a mensagem montada.
   - Erros ao lado do campo (aria-invalid + aria-describedby); honeypot "site"; LGPD desmarcado por padrão. */
(function () {
  "use strict";

  var ORIGEM = "clinica-odontologica";
  var dialogo = document.getElementById("dialogo-agenda");
  var form = document.getElementById("form-agenda");
  if (!dialogo || !form) return;

  var M = (window.Modelo && window.Modelo.config) || window.MODELO || {};
  var util = window.Modelo || { digitos: function (v) { return String(v || "").replace(/\D/g, ""); }, linkWhatsApp: function () { return ""; } };
  var api = String(M.api || "").replace(/\/+$/, "");
  var temApi = api !== "";

  var campos = {
    nome: form.elements.nome,
    telefone: form.elements.telefone,
    servico: form.elements.servico,
    data: form.elements.data,
    hora: form.elements.hora,
    slot: form.elements.slot,
    consentimento: form.elements.consentimento,
    site: form.elements.site
  };
  var blocoLivre = form.querySelector("[data-horario-livre]");
  var blocoApi = form.querySelector("[data-horario-api]");
  var dicaSlot = document.getElementById("ag-slot-dica");
  var status = form.querySelector("[data-status]");
  var botaoEnviar = form.querySelector("[data-enviar]");
  var sucesso = dialogo.querySelector("[data-sucesso]");
  var avisoDemo = dialogo.querySelector("[data-aviso-demo]");
  var abridor = null;

  /* ---------- modo ---------- */
  blocoLivre.hidden = temApi;
  blocoApi.hidden = !temApi;
  campos.hora.required = !temApi;
  campos.slot.required = temApi;
  avisoDemo.hidden = temApi;

  // Navegador sem <dialog>: os botões viram link de WhatsApp
  if (typeof dialogo.showModal !== "function") {
    document.querySelectorAll("[data-abrir-agenda]").forEach(function (b) {
      b.addEventListener("click", function () {
        var url = util.linkWhatsApp("Olá! Gostaria de agendar uma avaliação.");
        if (url) window.open(url, "_blank", "noopener");
      });
    });
    return;
  }

  /* ---------- datas ---------- */
  function hojeISO() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var dia = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + dia;
  }
  function dataBR(iso) {
    var p = String(iso).split("-");
    return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : iso;
  }
  campos.data.min = hojeISO();

  /* ---------- erros ao lado do campo ---------- */
  function elErro(campo) { return document.getElementById(campo.id + "-erro"); }
  function mostrarErro(campo, msg) {
    var e = elErro(campo);
    campo.setAttribute("aria-invalid", "true");
    if (e) { e.textContent = msg; e.hidden = false; }
  }
  function limparErro(campo) {
    var e = elErro(campo);
    campo.removeAttribute("aria-invalid");
    if (e) { e.textContent = ""; e.hidden = true; }
  }
  function limparStatus() { status.hidden = true; status.textContent = ""; }

  Object.keys(campos).forEach(function (k) {
    var c = campos[k];
    if (!c) return;
    c.addEventListener("input", function () { limparErro(c); limparStatus(); });
    c.addEventListener("change", function () { limparErro(c); limparStatus(); });
  });

  // Máscara leve de telefone: (00) 00000-0000
  campos.telefone.addEventListener("input", function () {
    var d = util.digitos(this.value).slice(0, 11);
    var f = d;
    if (d.length > 2) f = "(" + d.slice(0, 2) + ") " + d.slice(2);
    if (d.length > 7) f = "(" + d.slice(0, 2) + ") " + d.slice(2, d.length === 11 ? 7 : 6) + "-" + d.slice(d.length === 11 ? 7 : 6);
    this.value = f;
  });

  function validar() {
    var ok = true;
    function falha(campo, msg) { mostrarErro(campo, msg); if (ok) campo.focus(); ok = false; }

    if (campos.nome.value.trim().length < 3) falha(campos.nome, "Informe seu nome completo.");
    var tel = util.digitos(campos.telefone.value);
    if (tel.length < 10 || tel.length > 11) falha(campos.telefone, "Use DDD + número, ex.: (00) 00000-0000.");
    if (!campos.servico.value) falha(campos.servico, "Escolha o serviço.");
    if (!campos.data.value) falha(campos.data, "Escolha uma data.");
    else if (campos.data.value < hojeISO()) falha(campos.data, "A data precisa ser hoje ou depois.");
    if (temApi) {
      if (!campos.slot.value) falha(campos.slot, "Escolha um horário livre.");
    } else if (!campos.hora.value) {
      falha(campos.hora, "Escolha um horário.");
    }
    if (!campos.consentimento.checked) falha(campos.consentimento, "Precisamos da sua autorização para entrar em contato.");
    return ok;
  }

  /* ---------- horários da API ---------- */
  var controlador = null;
  function carregarSlots() {
    if (!temApi) return;
    var data = campos.data.value, servico = campos.servico.value;
    campos.slot.innerHTML = "";
    campos.slot.disabled = true;
    dicaSlot.hidden = true;
    if (!data || !servico) {
      campos.slot.add(new Option(!data ? "Escolha a data primeiro" : "Escolha o serviço primeiro", ""));
      return;
    }
    if (controlador) controlador.abort();
    controlador = new AbortController();
    campos.slot.add(new Option("Carregando…", ""));

    fetch(api + "/api/agenda/slots?data=" + encodeURIComponent(data) + "&servico=" + encodeURIComponent(servico), { signal: controlador.signal })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (json) {
        var slots = Array.isArray(json.slots) ? json.slots : [];
        campos.slot.innerHTML = "";
        if (!slots.length) {
          campos.slot.add(new Option("Nenhum horário livre nesse dia", ""));
          dicaSlot.textContent = "Tente outra data ou chame no WhatsApp para um encaixe.";
          dicaSlot.hidden = false;
          return;
        }
        campos.slot.add(new Option("Escolha…", ""));
        slots.forEach(function (s) { campos.slot.add(new Option(s, s)); });
        campos.slot.disabled = false;
      })
      .catch(function (err) {
        if (err.name === "AbortError") return;
        campos.slot.innerHTML = "";
        campos.slot.add(new Option("Não foi possível carregar", ""));
        dicaSlot.textContent = "Falha ao buscar horários. Tente de novo em instantes.";
        dicaSlot.hidden = false;
      });
  }
  campos.data.addEventListener("change", carregarSlots);
  campos.servico.addEventListener("change", carregarSlots);

  /* ---------- abrir / fechar ---------- */
  function reiniciar() {
    form.reset();
    form.hidden = false;
    sucesso.hidden = true;
    limparStatus();
    Object.keys(campos).forEach(function (k) { if (campos[k]) limparErro(campos[k]); });
    campos.data.min = hojeISO();
    carregarSlots();
  }

  document.querySelectorAll("[data-abrir-agenda]").forEach(function (b) {
    b.addEventListener("click", function () {
      abridor = b;
      reiniciar();
      var servico = b.getAttribute("data-servico");
      if (servico) campos.servico.value = servico;
      dialogo.showModal();
      campos.nome.focus();
    });
  });

  dialogo.querySelectorAll("[data-fechar-agenda]").forEach(function (b) {
    b.addEventListener("click", function () { dialogo.close(); });
  });

  // Clique no fundo (fora da caixa) fecha
  dialogo.addEventListener("click", function (e) {
    if (e.target !== dialogo) return;
    var r = dialogo.getBoundingClientRect();
    var fora = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    if (fora) dialogo.close();
  });

  dialogo.addEventListener("close", function () {
    if (abridor && document.contains(abridor)) abridor.focus();
  });

  /* ---------- envio ---------- */
  function mostrarSucesso(titulo, texto, link) {
    form.hidden = true;
    sucesso.hidden = false;
    sucesso.querySelector("[data-sucesso-titulo]").textContent = titulo;
    sucesso.querySelector("[data-sucesso-texto]").textContent = texto;
    var bloco = sucesso.querySelector("[data-sucesso-link]");
    bloco.hidden = !link;
    if (link) bloco.querySelector("a").href = link;
    sucesso.querySelector(".botao").focus();
  }

  function rotuloServico() {
    var opt = campos.servico.options[campos.servico.selectedIndex];
    return opt ? opt.text : campos.servico.value;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    limparStatus();
    if (!validar()) return;

    var hora = temApi ? campos.slot.value : campos.hora.value;
    var dados = {
      origem: ORIGEM,
      nome: campos.nome.value.trim(),
      telefone: util.digitos(campos.telefone.value),
      servico: campos.servico.value,
      inicio: campos.data.value + "T" + hora,
      consentimento: true,
      site: campos.site.value
    };

    // Honeypot preenchido: robô. Finge sucesso e não envia nada.
    if (dados.site) {
      mostrarSucesso("Pedido enviado", "Entraremos em contato para confirmar.");
      return;
    }

    if (!temApi) {
      var msg = "Olá! Quero agendar pelo site.\n"
        + "Serviço: " + rotuloServico() + "\n"
        + "Data: " + dataBR(campos.data.value) + " às " + hora + "\n"
        + "Nome: " + dados.nome + "\n"
        + "Telefone: " + campos.telefone.value;
      var url = util.linkWhatsApp(msg);
      if (!url) {
        url = "mailto:" + (M.email || "contato@exemplo.com.br") + "?subject=" + encodeURIComponent("Agendamento pelo site") + "&body=" + encodeURIComponent(msg);
      }
      var aba = window.open(url, "_blank", "noopener");
      mostrarSucesso(
        "Mensagem pronta",
        aba ? "Abrimos o WhatsApp com os dados do seu agendamento. É só enviar e aguardar a confirmação."
            : "Não conseguimos abrir o WhatsApp automaticamente. Use o link abaixo para enviar a mensagem.",
        url
      );
      return;
    }

    botaoEnviar.setAttribute("aria-busy", "true");
    fetch(api + "/api/agenda", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados)
    })
      .then(function (r) {
        if (r.status === 409) {
          mostrarErro(campos.slot, "Esse horário acabou de ser ocupado. Escolha outro.");
          carregarSlots();
          campos.slot.focus();
          return null;
        }
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (json) {
        if (!json) return;
        var protocolo = json.protocolo ? " Protocolo " + json.protocolo + "." : "";
        mostrarSucesso("Agendamento recebido", "Confirmamos por mensagem na véspera." + protocolo);
      })
      .catch(function () {
        status.textContent = "Não foi possível enviar agora. Tente de novo ou chame no WhatsApp.";
        status.hidden = false;
      })
      .finally(function () { botaoEnviar.removeAttribute("aria-busy"); });
  });
})();
