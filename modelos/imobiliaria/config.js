/* Tudo que muda de cliente para cliente fica aqui. Trocar de cliente = editar este arquivo.
 * Dados fictícios de demonstração. */
window.MODELO = {
  nome: "Imobiliária Marco Zero",
  slogan: "O ponto de partida do seu próximo endereço",
  creci: "CRECI-UF 00000-J",
  telefone: "(00) 00000-0000",
  whatsapp: "5500000000000", // só dígitos, com DDI; vazio esconde os botões de WhatsApp
  email: "contato@exemplo.com.br",
  endereco: "Rua Exemplo, 123 · Bairro · Cidade/UF",
  horarios: { seg_sex: "08:30–18:00", sab: "09:00–13:00", dom: "fechado" },

  api: "", // base da API (ex.: "https://api.exemplo.com.br"); vazio = modo sem backend (lead vai pelo WhatsApp)

  // Centro do mapa (o "marco zero" da cidade fictícia) e zoom inicial da vista de lista.
  mapa: { lat: -1.455, lng: -48.49, zoom: 13 },

  catalogo: {
    porPagina: 6
  }
};
