/* Tudo que muda de cliente para cliente fica aqui. Trocar de cliente = editar este arquivo.
 * Dados fictícios de demonstração. */
window.MODELO = {
  nome: "Cantina Nonna Rosa",
  slogan: "Massa fresca, molho de família",
  telefone: "(00) 00000-0000",
  whatsapp: "5500000000000", // só dígitos, com DDI; vazio esconde os botões de WhatsApp
  email: "contato@exemplo.com.br",
  endereco: "Rua Exemplo, 123 · Bairro · Cidade/UF",

  // Horário por dia da semana: [abre, fecha] em HH:MM, ou null quando não abre.
  // O status "aberto agora / fechado, abre às…" do cabeçalho é calculado daqui.
  horarios: {
    dom: ["11:30", "15:30"],
    seg: null,
    ter: ["18:00", "23:00"],
    qua: ["18:00", "23:00"],
    qui: ["18:00", "23:00"],
    sex: ["18:00", "23:30"],
    sab: ["11:30", "23:30"]
  },

  entrega: {
    taxa: 7.9,        // R$
    raioKm: 6,
    pedidoMinimo: 30, // R$; abaixo disso o checkout só permite retirada
    tempoMin: 35,     // minutos
    tempoMax: 50
  },
  retirada: {
    tempoMin: 20,
    tempoMax: 30
  },

  api: "", // base da API (ex.: "https://api.exemplo.com.br"); vazio = modo sem backend (pedido só pelo WhatsApp)

  mapa: { lat: -1.455, lng: -48.49, zoom: 16 }
};
