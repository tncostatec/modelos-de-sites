// Tudo que muda de cliente para cliente fica aqui. O HTML lê window.MODELO (assets/js/modelo.js).
// Dados fictícios de demonstração.
window.MODELO = {
  nome: "Andrade & Lima Advocacia",
  telefone: "(00) 00000-0000",
  whatsapp: "5500000000000",            // só dígitos, com DDI; vazio esconde os botões de WhatsApp
  email: "contato@exemplo.com.br",
  endereco: "Rua Exemplo, 123 · Bairro · Cidade/UF",
  horarios: { seg_sex: "09:00–18:00", sab: "mediante agendamento", dom: "fechado" },
  api: "",                              // base da API (ex.: "https://api.exemplo.com.br"); vazio = modo sem backend
  mapa: { lat: -1.455, lng: -48.49 }    // centro do mapa da página de contato
};
