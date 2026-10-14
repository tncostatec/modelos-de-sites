# Clínica Sorriso Pleno — clínica odontológica de bairro

![Captura do modelo no desktop](../../docs/img/clinica-odontologica-desktop.png)

## Nicho e objetivo

Clínica odontológica de bairro, atendimento para toda a família. O site tem um objetivo só: **agendar uma
avaliação**. Todo CTA leva ao mesmo `<dialog>` de agendamento; o WhatsApp é a segunda porta para quem prefere
conversar.

Identidade fictícia: verde-água profundo + branco + acento coral, tipografia Manrope. A assinatura visual é o
traço coral de "sorriso" desenhado sob a palavra-chave do título e repetido em miniatura como marcador de cada
seção.

## Técnica

"Vanilla moderno": HTML semântico e CSS atual, sem framework, sem build. O que este modelo demonstra:

| Recurso | Onde |
|---|---|
| Custom properties com escala tipográfica fluida (`clamp()`) | `assets/css/estilos.css`, seção 1 |
| `color-mix()` para tons derivados (hover, fundos suaves, linhas) | tokens `--coral-suave`, `--linha`, botões |
| Container queries (`container-type: inline-size` em cada `.secao`) | grades de serviços, equipe, convênios e localização |
| `<dialog>` nativo com `showModal()`, `::backdrop`, Esc e clique no fundo | agendamento (`assets/js/agenda.js`) |
| `<details name="faq">` como acordeão exclusivo, sem JS | seção Dúvidas |
| `IntersectionObserver` para destacar a seção ativa no menu (`aria-current`) | `assets/js/menu.js` |
| Validação com erro ao lado do campo (`aria-invalid` + `aria-describedby`) | `assets/js/agenda.js` |

JS em três arquivos pequenos, todos clássicos com `defer` (não ES modules, para funcionar aberto do disco):
`modelo.js` (preenche o `config.js` no HTML), `menu.js` (botão acessível, sombra ao rolar, seção ativa) e
`agenda.js` (diálogo e envio).

Decisão de contraste: o botão coral usa **texto escuro**, não branco. Branco sobre `#F2683C` dá 3,2:1 e reprova
no AA; o escuro `#12201F` dá 5,5:1.

## Estrutura

```
clinica-odontologica/
  README.md
  index.html              página única, com JSON-LD Dentist
  config.js               nome, telefone, WhatsApp, endereço, horários, API, mapa
  assets/css/estilos.css  tokens, componentes e seções (comentado por bloco)
  assets/js/modelo.js     lê window.MODELO e preenche [data-modelo], links e o iframe do mapa
  assets/js/menu.js       menu móvel, topo ao rolar, seção ativa (IntersectionObserver)
  assets/js/agenda.js     <dialog> de agendamento, validação, slots da API, envio/WhatsApp
  assets/img/favicon.svg
```

## Personalizar

1. **`config.js`** é o único arquivo obrigatório: nome, slogan, telefone, WhatsApp (só dígitos com DDI), e-mail,
   endereço, CNPJ, horários, `api` e coordenadas do mapa. O HTML lê tudo via `data-modelo="…"`.
2. **Textos** ficam no `index.html`, seção por seção (comentários `<!-- Serviços -->` etc.). Serviços, passos,
   equipe, convênios, depoimentos e FAQ são HTML puro: duplique um `<article>`/`<details>` para acrescentar.
3. **Equipe**: troque "Dra. Nome Exemplo" e "CRO-UF 00000" pelos dados reais e, se houver foto, substitua o SVG
   de avatar por `<img alt="…">`.
4. **Cores e tipografia**: tokens em `:root` no topo do CSS. Trocar `--verde-900`/`--coral` muda o site inteiro.
   A família do Google Fonts está no `<head>` (uma só, com `display=swap` e fallback de sistema).
5. **JSON-LD**: o bloco `Dentist` no `<head>` é estático; atualize telefone, endereço e horários junto com o
   `config.js`.

## Integrações

- **API** (`MODELO.api` preenchido): o campo de horário vira um `<select>` carregado de
  `GET {api}/api/agenda/slots?data=AAAA-MM-DD&servico=<id>` e o envio é `POST {api}/api/agenda` com
  `{origem: "clinica-odontologica", nome, telefone, servico, inicio, consentimento: true, site: ""}`. `201` mostra
  o protocolo; `409` marca o horário como ocupado e recarrega a lista.
- **Sem API** (GitHub Pages): campo `<input type="time">` livre e o envio abre `https://wa.me/<whatsapp>` com a
  mensagem montada; sem WhatsApp, cai em `mailto:`. O diálogo avisa "Demonstração sem servidor".
- **WhatsApp**: todo link com `data-modelo-href="whatsapp"` recebe o número do `config.js`; número vazio esconde os
  botões (`data-whatsapp`).
- **Mapa**: iframe do OpenStreetMap (`export/embed.html`) com `loading="lazy"`; `modelo.js` calcula o `bbox` a
  partir de `MODELO.mapa`. "Como chegar" abre as direções do OSM. Não precisa de chave.
- **Honeypot**: campo `site` fora da tela; preenchido, o front finge sucesso e não envia.

## Limites conhecidos

- O JSON-LD é estático: não lê o `config.js` (um script inline para isso quebraria a regra de CSP).
- O mapa do OpenStreetMap é um iframe de terceiro; em páginas com política de cookies estrita, troque por um
  link ou carregue sob consentimento.
- `<details name>` (acordeão exclusivo) e `color-mix()` precisam de navegadores de 2023 em diante; em versões
  antigas o FAQ abre vários itens ao mesmo tempo e os tons derivados caem para a cor base, sem quebrar nada.
- Sem backend, não há verificação de horário ocupado: o `input type="time"` aceita qualquer valor dentro do
  expediente.
- Depoimentos, convênios e números são exemplos marcados como tal; não há métricas inventadas.

## Como testar

```bash
python tools/qa.py --modelo clinica-odontologica
```

Confere, em 390 e 1440 px: rolagem horizontal, erros de console, `lang`, viewport, `<title>`, description, um só
`<h1>`, landmarks, link "pular para o conteúdo", JSON-LD, canonical, Open Graph, `alt` nas imagens, ausência de
handlers e scripts inline. Grava as capturas em `docs/img/clinica-odontologica-{desktop,mobile}.png`.

Teste manual sugerido: abrir "Agendar avaliação", enviar vazio (erros ao lado dos campos), preencher e confirmar
(abre o WhatsApp com a mensagem); navegar o menu e o FAQ só com Tab/Enter/Esc.
