# Imobiliária — Marco Zero

Site de uma imobiliária fictícia com catálogo de imóveis pesquisável, mapa e captação de interessados. Imóveis,
preços, bairros, nome e CRECI são exemplos.

## Nicho e objetivo

Imobiliária de bairro, venda e locação. O site tem dois trabalhos: deixar o visitante **encontrar** o imóvel
(filtrar, comparar no mapa, voltar depois para o mesmo resultado, compartilhar a busca) e **captar** o contato
dele — "Tenho interesse" na página do imóvel e "Anuncie seu imóvel" para proprietários.

## Técnica

Este modelo demonstra um catálogo inteiro no navegador, sem framework e sem backend, com três mecanismos:

1. **Estado dos filtros na URL.** Finalidade, tipo, bairro, preço mínimo e máximo, quartos, ordenação, página,
   favoritos e vista (lista/mapa) vivem em `URLSearchParams` (`?finalidade=venda&tipo=casa&bairro=centro`). Cada
   mudança faz `history.pushState`; `popstate` relê a URL e re-renderiza, então **voltar e avançar funcionam** e
   qualquer busca pode ser colada no WhatsApp. O mapa esquemático do hero e a busca rápida só escrevem nesses
   mesmos parâmetros.
2. **Roteamento por hash.** `#/imovel/<id>` abre a página do imóvel (galeria com navegação por teclado, ficha
   técnica, mapa com um marcador, formulário pré-preenchido com o código) sem recarregar e sem perder os filtros,
   que ficam na parte `?` da URL. "Voltar aos resultados" usa `history.back()` quando o detalhe veio da lista e
   devolve o foco ao título dos resultados. Um id inexistente volta à lista com aviso e troca a rota por
   `replaceState` para não deixar link quebrado no histórico.
3. **Mapa com Leaflet 1.9.4** carregado por CDN com versão fixa e `integrity` (hashes publicados na página de
   download do Leaflet e conferidos contra os arquivos), tiles do OpenStreetMap com atribuição. A vista "Mapa"
   mostra todos os imóveis do filtro atual (não só da página), com popup que leva ao detalhe. Os marcadores são
   `L.divIcon` com SVG inline (o "marco" da identidade), então nenhuma imagem externa além dos tiles é carregada.

Complementos: paginação de 6 em 6, contagem de resultados em `aria-live`, favoritos em `localStorage` com
coração `aria-pressed` (no card, no detalhe e no cabeçalho), cards onde o imóvel inteiro é **um único link**
(`::after` esticado) e o coração fica fora dele.

### Identidade visual

Azul-marinho, areia e verde-oliva; Manrope em todos os papéis. A assinatura é cartográfica, no espírito do nome:
grade de carta topográfica atrás do hero, um **mapa esquemático dos cinco bairros** desenhado à mão em SVG — cada
região é um link que filtra, e a contagem de imóveis por bairro vem do JSON — e o marco geodésico (cruz com
círculo) como logotipo, marcador do Leaflet e ponto central do mapa. As "fotos" dos imóveis são composições SVG
(`<symbol>` no sprite da página, 19 cenas), referenciadas por id em `imoveis.json`.

## Estrutura

```
modelos/imobiliaria/
  index.html              hero + busca rápida + mapa dos bairros, catálogo (filtros, cards, paginação, mapa),
                          detalhe (rota por hash), anuncie seu imóvel, rodapé; sprite SVG com fotos e ícones
  config.js               window.MODELO — nome, CRECI, contato, horários, API, centro do mapa, itens por página
  imoveis.json            12 imóveis fictícios + dicionários de bairros e tipos
  README.md
  assets/css/estilo.css   estilos próprios (inclui ajustes do Leaflet e do mapa esquemático)
  assets/js/modelo.js     lê MODELO, preenche data-modelo, links de contato, menu; utilidades e favoritos
  assets/js/mapa.js       camada fina sobre o Leaflet: mapa, tiles OSM, marcador SVG
  assets/js/leads.js      formulários de lead (validação, consentimento, honeypot, POST ou WhatsApp)
  assets/js/detalhe.js    página do imóvel: galeria, ficha, mapa, favorito, formulário pré-preenchido
  assets/js/catalogo.js   carga do JSON, filtros ↔ URL, ordenação, paginação, vista lista/mapa, rotas
  assets/img/icone.svg    favicon
```

## Personalizar

- **Dados da imobiliária**: `config.js` — nome, CRECI, telefone, WhatsApp (só dígitos com DDI), e-mail,
  endereço, horários, centro e zoom do mapa, `catalogo.porPagina`. Os pontos marcados com `data-modelo="…"` são
  preenchidos a partir daí.
- **Imóveis**: `imoveis.json`. Cada um tem `id` (estável — é o que entra na URL e nos favoritos), `titulo`,
  `tipo` e `bairro` (chaves dos dicionários `tipos` e `bairros` no topo do arquivo), `finalidade` (`venda` |
  `aluguel`; no aluguel o preço é mensal), `preco`, `condominio`, `area`, `terreno`, `quartos`, `banheiros`,
  `vagas`, `lat`/`lng`, `publicadoEm` (ordenação "mais recentes"), `descricao`, `diferenciais` e `fotos` (3 ids de
  `<symbol id="foto-…">` do sprite). Para fotos reais, troque o `<use>` por `<img>` em `renderCard` e em
  `detalhe.js`; as legendas ficam em `LEGENDAS`.
- **Bairros no mapa esquemático**: as cinco regiões são `<a class="regiao" data-bairro="…">` no `index.html`;
  os ids precisam bater com `bairros` do JSON. Mudou de cidade? Redesenhe os polígonos (viewBox 600×420).
- **JSON-LD**: o bloco `RealEstateAgent` no `<head>` repete contato e horários — mantenha em sincronia.
- **Cores e tipografia**: variáveis no topo de `assets/css/estilo.css`.

## Integrações

- **Leads** (`form.lead`): com `MODELO.api`, `POST {api}/api/leads` com `{origem: "imobiliaria", nome, telefone,
  email?, mensagem, consentimento: true, site: ""}`; a `mensagem` começa com o assunto ("Interesse no imóvel
  MZ-1041" ou "Quero anunciar meu imóvel"). Se a API falhar, o formulário mostra o erro com um link para enviar
  pelo WhatsApp. Sem API (GitHub Pages), a mensagem abre em `wa.me/<whatsapp>?text=…` — ou `mailto:` sem
  WhatsApp — e a interface avisa: "Demonstração sem servidor".
- **Mapa**: Leaflet 1.9.4 via unpkg (`integrity` + `crossorigin`). Os **tiles do OpenStreetMap são um serviço
  externo** com [política de uso](https://operations.osmfoundation.org/policies/tiles/) própria: aceitável para
  um site pequeno, mas um portal com tráfego alto deve usar um provedor de tiles (ou um proxy próprio) e manter a
  atribuição. Sem conexão com o CDN, o site mostra "O mapa não carregou" e a lista continua funcionando.
- **WhatsApp e telefone**: botões `data-modelo-href` montados a partir do `config.js`.

## Limites conhecidos

- **`file://`**: o `fetch("imoveis.json")` é bloqueado pelo Chrome quando a página é aberta direto do disco.
  Use um servidor local (`python -m http.server` na raiz do repositório ou o `tools/qa.py`).
- **Localização exata**: as coordenadas do JSON são exibidas como estão. Para um site real, convém deslocar o
  ponto ou mostrar só o bairro (o texto "localização aproximada" já está na página).
- **Preço mínimo/máximo** compara o número bruto: com finalidade "Todas", venda (centenas de milhares) e aluguel
  (milhares/mês) ficam na mesma escala. Escolha a finalidade antes de filtrar por preço.
- **Favoritos** vivem no navegador do visitante (`localStorage`): não sincronizam entre dispositivos.
- Sem backend, não há área do corretor, nem agendamento de visita, nem envio de fotos reais.
- O catálogo inteiro vem num único JSON; passa bem de algumas centenas de imóveis, mas milhares pedem API com
  paginação no servidor.

## Como testar

```bash
python tools/qa.py --modelo imobiliaria
```

Confere, em 390 e 1440 px, rolagem horizontal, console limpo, itens de acessibilidade/SEO e grava capturas em
`docs/img/imobiliaria-{desktop,mobile}.png`. Para ver o estado na URL: filtre, copie o endereço e abra noutra
aba; use voltar/avançar do navegador; abra `#/imovel/MZ-1046` direto e volte aos resultados.
