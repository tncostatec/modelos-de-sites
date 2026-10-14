/* Componentes Alpine.js do Ateliê Belle. Registrados em alpine:init, por isso este arquivo
   vem ANTES do script do Alpine no HTML (ambos com defer, executam na ordem do documento).
   - abas()        → serviços por categoria (role=tablist, setas do teclado)
   - galeria()     → lightbox em <dialog> nativo com navegação por teclado
   - agendamento() → stepper serviço → profissional → data → horário → seus dados
   Dados de serviços, profissionais e horários de exemplo ficam aqui, não no HTML. */
(function () {
  "use strict";

  var ORIGEM = "estetica-salao";

  var CATEGORIAS = [
    { id: "cabelo", nome: "Cabelo" },
    { id: "unhas", nome: "Unhas" },
    { id: "facial", nome: "Estética facial" },
    { id: "depilacao", nome: "Depilação" }
  ];

  // Preço "a partir de R$ --" é placeholder de propósito: valor real entra na personalização.
  var SERVICOS = {
    cabelo: [
      { id: "corte-feminino", nome: "Corte feminino", duracao: 60, nota: "Lavagem, corte e finalização" },
      { id: "corte-masculino", nome: "Corte masculino", duracao: 40, nota: "Com acabamento na navalha" },
      { id: "coloracao", nome: "Coloração", duracao: 120, nota: "Raiz ou global, com teste de mecha" },
      { id: "mechas", nome: "Mechas e luzes", duracao: 180, nota: "Inclui tonalização" },
      { id: "escova", nome: "Escova e finalização", duracao: 45, nota: "Lisa, ondulada ou modelada" },
      { id: "hidratacao", nome: "Hidratação profunda", duracao: 60, nota: "Diagnóstico do fio incluso" }
    ],
    unhas: [
      { id: "manicure", nome: "Manicure", duracao: 45, nota: "Cutilagem e esmaltação" },
      { id: "pedicure", nome: "Pedicure", duracao: 50, nota: "Com esfoliação" },
      { id: "gel", nome: "Esmaltação em gel", duracao: 60, nota: "Dura até 3 semanas" },
      { id: "alongamento", nome: "Alongamento em fibra", duracao: 120, nota: "Primeira aplicação" },
      { id: "spa-pes", nome: "Spa dos pés", duracao: 60, nota: "Hidratação e massagem" }
    ],
    facial: [
      { id: "limpeza-pele", nome: "Limpeza de pele", duracao: 75, nota: "Com extração e máscara calmante" },
      { id: "peeling", nome: "Peeling suave", duracao: 45, nota: "Indicado após avaliação" },
      { id: "sobrancelha", nome: "Design de sobrancelhas", duracao: 30, nota: "Com henna opcional" },
      { id: "hidratacao-facial", nome: "Hidratação facial", duracao: 50, nota: "Para todos os tipos de pele" },
      { id: "massagem-facial", nome: "Massagem facial", duracao: 40, nota: "Drenagem e relaxamento" }
    ],
    depilacao: [
      { id: "pernas", nome: "Pernas completas", duracao: 45, nota: "Cera morna" },
      { id: "axilas", nome: "Axilas", duracao: 15, nota: "Cera morna" },
      { id: "virilha", nome: "Virilha", duracao: 30, nota: "Simples ou completa" },
      { id: "buco", nome: "Buço", duracao: 10, nota: "Cera ou linha" },
      { id: "corpo", nome: "Corpo completo", duracao: 90, nota: "Pernas, axilas, virilha e braços" }
    ]
  };

  var PROFISSIONAIS = [
    { id: "qualquer", nome: "Sem preferência", area: "Quem estiver livre no horário" },
    { id: "prof-1", nome: "Nome Exemplo", area: "Cabelo: cortes e coloração" },
    { id: "prof-2", nome: "Nome Exemplo", area: "Unhas e spa" },
    { id: "prof-3", nome: "Nome Exemplo", area: "Estética facial e depilação" }
  ];

  // Lista fixa usada no modo sem backend (MODELO.api vazio)
  var SLOTS_EXEMPLO = ["09:00", "09:45", "10:30", "11:15", "13:00", "13:45", "14:30", "15:15", "16:00", "16:45", "17:30"];

  function util() {
    return window.Modelo || { config: window.MODELO || {}, digitos: function (v) { return String(v || "").replace(/\D/g, ""); }, linkWhatsApp: function () { return ""; } };
  }

  function hojeISO() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function dataBR(iso) {
    var p = String(iso || "").split("-");
    return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : iso;
  }
  function diaDaSemana(iso) {
    var p = String(iso || "").split("-").map(Number);
    if (p.length !== 3) return -1;
    return new Date(p[0], p[1] - 1, p[2]).getDay();
  }
  function mascaraTelefone(valor) {
    var d = util().digitos(valor).slice(0, 11);
    if (d.length > 7) return "(" + d.slice(0, 2) + ") " + d.slice(2, d.length === 11 ? 7 : 6) + "-" + d.slice(d.length === 11 ? 7 : 6);
    if (d.length > 2) return "(" + d.slice(0, 2) + ") " + d.slice(2);
    return d;
  }

  document.addEventListener("alpine:init", function () {
    var Alpine = window.Alpine;

    /* ---------- abas de serviços ---------- */
    Alpine.data("abas", function () {
      return {
        categorias: CATEGORIAS,
        servicos: SERVICOS,
        ativa: "cabelo",
        selecionar: function (id) {
          this.ativa = id;
          var self = this;
          this.$nextTick(function () {
            var tab = self.$root.querySelector('[role="tab"][data-aba="' + id + '"]');
            if (tab) tab.focus();
          });
        },
        mover: function (passo) {
          var i = this.categorias.findIndex(function (c) { return c.id === this.ativa; }, this);
          var n = (i + passo + this.categorias.length) % this.categorias.length;
          this.selecionar(this.categorias[n].id);
        }
      };
    });

    /* ---------- galeria com lightbox ---------- */
    Alpine.data("galeria", function () {
      return {
        itens: [],
        atual: 0,
        aberta: false,
        init: function () {
          this.itens = Array.prototype.map.call(this.$root.querySelectorAll("[data-galeria-item]"), function (b) {
            return { titulo: b.getAttribute("data-titulo"), categoria: b.getAttribute("data-categoria"), svg: b.querySelector("svg") };
          });
        },
        get item() { return this.itens[this.atual] || { titulo: "", categoria: "" }; },
        mostrar: function () {
          var fig = this.$refs.figura;
          if (!fig || !this.item.svg) return;
          fig.replaceChildren(this.item.svg.cloneNode(true));
        },
        abrir: function (i) {
          this.atual = i;
          this.mostrar();
          this.aberta = true;
          if (typeof this.$refs.caixa.showModal === "function") this.$refs.caixa.showModal();
          this.$refs.fechar.focus();
        },
        fechar: function () { this.$refs.caixa.close(); },
        proxima: function () { this.atual = (this.atual + 1) % this.itens.length; this.mostrar(); },
        anterior: function () { this.atual = (this.atual - 1 + this.itens.length) % this.itens.length; this.mostrar(); },
        cliqueFora: function (e) {
          var r = this.$refs.caixa.getBoundingClientRect();
          if (e.target === this.$refs.caixa && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) this.fechar();
        }
      };
    });

    /* ---------- agendamento em etapas ---------- */
    Alpine.data("agendamento", function () {
      return {
        etapas: ["Serviço", "Profissional", "Data", "Horário", "Seus dados"],
        etapa: 1,
        alcancada: 1,
        categorias: CATEGORIAS,
        profissionais: PROFISSIONAIS,
        categoria: "cabelo",
        servico: null,
        profissional: "",
        data: "",
        hora: "",
        nome: "",
        telefone: "",
        consentimento: false,
        site: "",
        slots: [],
        carregando: false,
        avisoSlots: "",
        erros: {},
        enviando: false,
        statusErro: "",
        enviado: null,
        minData: hojeISO(),

        get temApi() { return String(util().config.api || "").trim() !== ""; },
        get api() { return String(util().config.api || "").replace(/\/+$/, ""); },
        get servicos() { return SERVICOS[this.categoria] || []; },
        get nomeProfissional() {
          var p = PROFISSIONAIS.find(function (x) { return x.id === this.profissional; }, this);
          return p ? p.nome : "";
        },
        get dataBR() { return dataBR(this.data); },

        init: function () {
          var self = this;
          this.$watch("data", function () { self.hora = ""; self.carregarSlots(); });
          this.$watch("servico", function () { self.hora = ""; if (self.data) self.carregarSlots(); });
          this.$watch("telefone", function (v) { var m = mascaraTelefone(v); if (m !== v) self.telefone = m; });
          window.addEventListener("escolher-servico", function (e) { self.escolherPorId(e.detail && e.detail.id); });
        },

        escolherPorId: function (id) {
          var self = this;
          Object.keys(SERVICOS).some(function (cat) {
            var s = SERVICOS[cat].find(function (x) { return x.id === id; });
            if (s) { self.categoria = cat; self.escolher(s); return true; }
            return false;
          });
          this.etapa = 1;
        },
        escolher: function (s) { this.servico = s; delete this.erros.servico; },

        focarTitulo: function () {
          var self = this;
          this.$nextTick(function () { if (self.$refs.titulo) self.$refs.titulo.focus({ preventScroll: true }); });
        },
        irPara: function (n) {
          if (n > this.alcancada) return;
          this.etapa = n;
          this.focarTitulo();
        },
        avancar: function () {
          if (!this.validar(this.etapa)) return;
          this.etapa = Math.min(this.etapa + 1, this.etapas.length);
          this.alcancada = Math.max(this.alcancada, this.etapa);
          this.focarTitulo();
        },
        voltar: function () {
          this.etapa = Math.max(1, this.etapa - 1);
          this.focarTitulo();
        },

        validar: function (etapa) {
          var e = {};
          if (etapa === 1 && !this.servico) e.servico = "Escolha um serviço para continuar.";
          if (etapa === 2 && !this.profissional) e.profissional = "Escolha uma profissional ou \"Sem preferência\".";
          if (etapa === 3) {
            if (!this.data) e.data = "Escolha uma data.";
            else if (this.data < hojeISO()) e.data = "A data precisa ser hoje ou depois.";
          }
          if (etapa === 4 && !this.hora) e.hora = "Escolha um horário.";
          if (etapa === 5) {
            if (this.nome.trim().length < 3) e.nome = "Informe seu nome completo.";
            var tel = util().digitos(this.telefone);
            if (tel.length < 10 || tel.length > 11) e.telefone = "Use DDD + número, ex.: (00) 00000-0000.";
            if (!this.consentimento) e.consentimento = "Precisamos da sua autorização para confirmar o horário.";
          }
          this.erros = e;
          var primeiro = Object.keys(e)[0];
          if (primeiro) {
            var self = this;
            this.$nextTick(function () {
              var alvo = self.$root.querySelector("[data-foco-erro='" + primeiro + "']");
              if (alvo) alvo.focus();
            });
          }
          return !primeiro;
        },

        carregarSlots: function () {
          var self = this;
          this.slots = [];
          this.avisoSlots = "";
          if (!this.data) return;

          var dom = util().config.horarios && util().config.horarios.dom;
          if (diaDaSemana(this.data) === 0 && String(dom || "").toLowerCase() === "fechado") {
            this.avisoSlots = "Não abrimos aos domingos. Escolha outro dia.";
            return;
          }
          if (!this.temApi) { this.slots = SLOTS_EXEMPLO.slice(); return; }

          this.carregando = true;
          var servico = this.servico ? this.servico.id : "";
          fetch(this.api + "/api/agenda/slots?data=" + encodeURIComponent(this.data) + "&servico=" + encodeURIComponent(servico))
            .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
            .then(function (json) {
              self.slots = Array.isArray(json.slots) ? json.slots : [];
              if (!self.slots.length) self.avisoSlots = "Nenhum horário livre nesse dia. Tente outra data.";
            })
            .catch(function () { self.avisoSlots = "Não foi possível carregar os horários. Tente de novo em instantes."; })
            .finally(function () { self.carregando = false; });
        },

        enviar: function () {
          if (this.etapa < 5) { this.avancar(); return; }
          if (!this.validar(5)) return;
          var self = this;
          var u = util();
          var dados = {
            origem: ORIGEM,
            nome: this.nome.trim(),
            telefone: u.digitos(this.telefone),
            servico: this.servico.id,
            profissional: this.profissional,
            inicio: this.data + "T" + this.hora,
            consentimento: true,
            site: this.site
          };

          // Honeypot preenchido: robô. Finge sucesso e não envia nada.
          if (dados.site) { this.enviado = { titulo: "Pedido enviado", texto: "Entraremos em contato para confirmar." }; return; }

          if (!this.temApi) {
            var msg = "Olá! Quero marcar pelo site.\n"
              + "Serviço: " + this.servico.nome + " (" + this.servico.duracao + " min)\n"
              + "Profissional: " + this.nomeProfissional + "\n"
              + "Data: " + this.dataBR + " às " + this.hora + "\n"
              + "Nome: " + dados.nome + "\n"
              + "Telefone: " + this.telefone;
            var url = u.linkWhatsApp(msg) || ("mailto:" + (u.config.email || "contato@exemplo.com.br") + "?subject=" + encodeURIComponent("Agendamento pelo site") + "&body=" + encodeURIComponent(msg));
            var aba = window.open(url, "_blank", "noopener");
            this.enviado = {
              titulo: "Mensagem pronta",
              texto: aba ? "Abrimos o WhatsApp com os dados do seu horário. É só enviar e aguardar a confirmação."
                         : "Não conseguimos abrir o WhatsApp automaticamente. Use o link abaixo.",
              link: url
            };
            return;
          }

          this.enviando = true;
          this.statusErro = "";
          fetch(this.api + "/api/agenda", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(dados) })
            .then(function (r) {
              if (r.status === 409) {
                self.etapa = 4;
                self.erros = { hora: "Esse horário acabou de ser ocupado. Escolha outro." };
                self.carregarSlots();
                return null;
              }
              if (!r.ok) throw new Error("HTTP " + r.status);
              return r.json();
            })
            .then(function (json) {
              if (!json) return;
              self.enviado = { titulo: "Horário reservado", texto: "Confirmamos por mensagem na véspera." + (json.protocolo ? " Protocolo " + json.protocolo + "." : "") };
            })
            .catch(function () { self.statusErro = "Não foi possível enviar agora. Tente de novo ou chame no WhatsApp."; })
            .finally(function () { self.enviando = false; });
        },

        reiniciar: function () {
          this.etapa = 1; this.alcancada = 1;
          this.servico = null; this.profissional = ""; this.data = ""; this.hora = "";
          this.nome = ""; this.telefone = ""; this.consentimento = false; this.site = "";
          this.erros = {}; this.statusErro = ""; this.enviado = null; this.slots = [];
          this.focarTitulo();
        }
      };
    });
  });
})();
