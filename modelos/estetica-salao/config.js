// Tudo que muda de cliente para cliente fica aqui. O HTML lê este objeto e preenche os pontos
// marcados com data-modelo="..." (ver assets/js/modelo.js). Dados abaixo são fictícios.
window.MODELO = {
  nome: "Ateliê Belle",
  slogan: "Cabelo, unhas e pele, com hora marcada",
  telefone: "(00) 00000-0000",
  whatsapp: "5500000000000", // só dígitos, com DDI; vazio esconde os botões de WhatsApp
  email: "contato@exemplo.com.br",
  endereco: "Rua Exemplo, 123 · Bairro · Cidade/UF",
  cnpj: "00.000.000/0001-00",
  horarios: { seg_sex: "09:00–19:00", sab: "09:00–17:00", dom: "fechado" },
  api: "", // base da API (ex.: "https://api.exemplo.com.br"); vazio = modo sem backend (WhatsApp)
  mapa: { lat: -1.455, lng: -48.49 }
};
