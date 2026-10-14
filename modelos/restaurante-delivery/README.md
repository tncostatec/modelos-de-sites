# Restaurante com delivery — Cantina Nonna Rosa

Site de uma cantina italiana fictícia que recebe pedidos pelo WhatsApp e pode ser instalado no celular como
aplicativo. Nome, endereço, telefone, cardápio e preços são exemplos.

## Nicho e objetivo

Restaurante de bairro com entrega própria e retirada no balcão. O site tem um trabalho: o cliente monta o pedido
no cardápio, confere o total e envia pelo WhatsApp, sem cadastro, sem app de terceiros e sem comissão de
marketplace. Secundariamente, mostra se a casa está aberta agora, quanto custa a entrega e onde fica.

## Técnica

Este modelo demonstra três coisas que os outros modelos do repositório não demonstram:

1. **PWA instalável.** `manifest.webmanifest` + `sw.js` com escopo relativo (`./`), para o site funcionar num
   subcaminho do GitHub Pages. O service worker pré-cacheia o shell (HTML, CSS, JS, ícone, manifesto) na
   instalação, serve os assets próprios *cache-first*, busca `cardapio.json` *network-first* com fallback ao cache
   e limpa caches de versões antigas no `activate`. O registro só acontece em `http`/`https`; aberto do disco
   (`file://`) o script pula o registro sem erro no console. Quando o navegador dispara `beforeinstallprompt`,
   aparece o botão "Instalar app" no cabeçalho.
2. **Cardápio dirigido por dados.** Um único `cardapio.json` (4 categorias, 20 itens, etiquetas, disponibilidade,
   destaques) alimenta a lista completa, a navegação fixa de categorias com destaque da ativa, a busca por texto
   (sem acento, sem maiúsculas), o filtro por etiqueta e a "lousa" de destaques do hero. O restaurante troca
   preço ou marca um prato como esgotado editando o JSON, sem tocar no HTML.
3. **Carrinho sem backend.** Estado em `localStorage` (só id, quantidade e observação; preço e nome vêm sempre do
   cardápio carregado, então um preço antigo nunca fica preso no navegador). Painel em `<dialog>` nativo — foco
   preso, `Esc` fecha, foco volta ao botão de origem. Checkout com validação ao lado do campo, entrega ou
   retirada (endereço condicional), pagamento (Pix, cartão, dinheiro com troco validado contra o total),
   consentimento LGPD e honeypot. A mensagem consolidada abre em `wa.me/<número>?text=` e, se `MODELO.api`
   estiver definido, também vai para `POST {api}/api/leads` com `origem: "restaurante-delivery"`.

Também calcula o status "Aberto agora · fecha às HH:MM" / "Fechado · abre hoje|amanhã|sex. às HH:MM" a partir
da tabela de horários por dia da semana em `config.js`, atualizado a cada minuto.

### Identidade visual

Paleta escura e quente (grafite, âmbar, creme), Fraunces nos títulos (eixo óptico e itálico para ênfase) com
fonte de sistema no corpo. A assinatura é tipográfica: o cardápio é uma lista de trattoria com **líder pontilhado
entre o prato e o preço**, não uma grade de cards de e-commerce. O mesmo líder aparece na lousa do hero e no
carrinho, e a textura de toalha xadrez do hero é quase imperceptível de propósito.

## Estrutura

```
modelos/restaurante-delivery/
  index.html              página única: hero, cardápio, a cantina, entrega e horários, onde estamos, carrinho (<dialog>)
  config.js               window.MODELO — nome, contato, horários por dia, taxa/raio/tempo de entrega, API, mapa
  cardapio.json           categorias, pratos, preços, etiquetas, disponível, destaque
  manifest.webmanifest    nome, cores, start_url/scope relativos, ícone SVG
  sw.js                   service worker (precache do shell, cache-first, network-first p/ cardapio.json)
  README.md
  assets/css/estilo.css   estilos próprios
  assets/js/modelo.js     lê MODELO: textos data-modelo, links de WhatsApp/telefone/e-mail, menu, horários e status
  assets/js/carrinho.js   estado em localStorage, painel, checkout, mensagem do pedido, POST opcional
  assets/js/cardapio.js   fetch do JSON, renderização, busca, filtros, categoria ativa, lousa
  assets/js/pwa.js        registro do service worker e botão "Instalar app"
  assets/img/icone.svg    ícone do app e favicon
```

## Personalizar

- **Dados do restaurante**: tudo em `config.js` — nome, telefone, WhatsApp (só dígitos com DDI), e-mail,
  endereço, horários (`[abre, fecha]` por dia ou `null`), taxa, raio, pedido mínimo, tempos de entrega e retirada,
  coordenadas do mapa. Os pontos da página marcados com `data-modelo="…"` são preenchidos a partir daí.
- **Cardápio**: `cardapio.json`. Cada prato tem `id` (único, estável — é o que o carrinho guarda), `nome`,
  `descricao`, `preco`, `etiquetas` (chaves de `etiquetas` no topo do arquivo), `disponivel` e `destaque` (entra na
  lousa do hero; até 4).
- **Textos**: o hero, "A cantina", a citação e as notas são estáticos no `index.html`.
- **JSON-LD**: o bloco `Restaurant` no `<head>` repete telefone, endereço e horários — ao mudar o `config.js`,
  atualize-o também (é estático para funcionar sem JavaScript nos robôs).
- **Versão do cache**: mudou CSS/JS/HTML em produção? Troque `VERSAO` em `sw.js`; o `activate` apaga o cache
  anterior.
- **Cores e tipografia**: variáveis no topo de `assets/css/estilo.css`; a fonte do Google é a única dependência
  externa (com fallback serifado de sistema).

## Integrações

- **WhatsApp** (padrão): a mensagem do pedido abre em `https://wa.me/<whatsapp>?text=…` ainda dentro do gesto do
  usuário, para não cair no bloqueio de pop-up. Sem WhatsApp configurado, cai em `mailto:`.
- **API** (`MODELO.api`): `POST {api}/api/leads` com `{origem: "restaurante-delivery", nome, telefone, mensagem,
  consentimento: true, site: ""}`; a resposta `201 {id, protocolo}` aparece na tela de sucesso. Se a API falhar, o
  pedido já seguiu pelo WhatsApp e a tela avisa.
- **Mapa**: `<iframe>` do OpenStreetMap com `loading="lazy"`, montado a partir de `MODELO.mapa`. É um serviço
  externo com [política de uso](https://operations.osmfoundation.org/policies/tiles/) própria.
- **PWA**: ver "Técnica". O ícone é SVG (`purpose: any`), aceito pelo Chromium (Android e desktop).

## Limites conhecidos

- **iOS não usa ícone SVG** do manifesto; para a tela inicial do iPhone seria preciso gerar PNG (180×180 em
  `apple-touch-icon` e 192/512 no manifesto). O repositório não guarda binários, então ficou de fora.
- **`file://`**: o `fetch("cardapio.json")` é bloqueado pelo Chrome quando a página é aberta direto do disco (a
  tela mostra "O cardápio não carregou" com botão de tentar de novo). Use um servidor local — `python -m http.server`
  na raiz do repositório ou o próprio `tools/qa.py`. O service worker também exige `http(s)`.
- **Sem backend, não há confirmação automática**: o pedido só existe quando o restaurante responde no WhatsApp.
  Estoque, status e pagamento online pedem a API.
- O status "aberto/fechado" usa o relógio do visitante, não um fuso fixo. Horário que atravessa a meia-noite
  (ex.: 18:00–01:00) não é suportado nesta versão.
- O JSON-LD de horários é estático e precisa ser mantido em sincronia com o `config.js`.

## Como testar

```bash
python tools/qa.py --modelo restaurante-delivery
```

Confere, em 390 e 1440 px, rolagem horizontal, console limpo, itens de acessibilidade/SEO e grava capturas em
`docs/img/restaurante-delivery-{desktop,mobile}.png`. Para testar a instalação como app, abra num servidor
`http://localhost` no Chrome (Android ou desktop): `Instalar app` aparece no cabeçalho; depois, desligue a rede e
recarregue — o cardápio vem do cache.
