# Ateliê Belle — salão de beleza e estética

![Captura do modelo no desktop](../../docs/img/estetica-salao-desktop.png)

## Nicho e objetivo

Salão de beleza e estética (cabelo, unhas, estética facial e depilação). Dois objetivos: **agendar horário** e
**mostrar portfólio**. O agendamento é um stepper de cinco etapas (serviço → profissional → data → horário →
seus dados) com resumo ao lado; o portfólio é uma galeria com lightbox.

Identidade fictícia: rosé + areia + grafite, títulos em Playfair Display (itálico como destaque) e corpo em
fonte de sistema. A assinatura visual é o "swatch", a pincelada orgânica em SVG que aparece no hero e vira a
linguagem das doze composições da galeria (não há fotos: são ilustrações vetoriais).

## Técnica

**Tailwind CSS compilado localmente + Alpine.js** para interatividade declarativa.

- `tailwind.config.js` define a paleta (`rose`, `areia`, `grafite`), as famílias (`font-display`, `font-sans`) e
  tokens de sombra/animação. `assets/css/tailwind.css` tem `@tailwind base/components/utilities` e componentes
  próprios em `@layer components` (`.btn`, `.campo`, `.opcao`, `.aba`, `.tile`, `.eyebrow`…).
- O CSS gerado (`assets/css/styles.css`, ~26 KB minificado) é versionado junto com a fonte: o site funciona sem
  Node. Para regenerar, de dentro da pasta do modelo:

  ```bash
  npx --yes tailwindcss@3.4.17 -c tailwind.config.js -i assets/css/tailwind.css -o assets/css/styles.css --minify
  ```

- Alpine.js 3.14.8 via jsDelivr, versão fixa, `integrity` (SRI) e `defer`. Os componentes são registrados em
  `assets/js/app.js` com `Alpine.data()` no evento `alpine:init`, por isso o arquivo vem antes do script do
  Alpine. O HTML usa `x-data`, `x-on:`, `x-bind:`, `x-show`, `x-for`, `x-model`, `$dispatch` e `$refs`; nada de
  `onclick=`.

| Componente | O que faz |
|---|---|
| menu (inline, `{ aberto }`) | botão com `aria-expanded`/`aria-controls`, fecha com Esc e ao clicar em link |
| `abas` | serviços por categoria com `role="tablist"`, `aria-selected`, setas/Home/End no teclado |
| `galeria` | lightbox em `<dialog>` nativo: clona o SVG do item, ← → navegam, Esc fecha, contador `aria-live` |
| `agendamento` | stepper com validação por etapa, erros `aria-invalid`/`aria-describedby`, foco no título da etapa, resumo reativo, horários da API ou lista fixa, envio POST ou WhatsApp |

## Estrutura

```
estetica-salao/
  README.md
  index.html                  página única, com JSON-LD BeautySalon
  config.js                   nome, telefone, WhatsApp, endereço, horários, API, mapa
  tailwind.config.js          paleta, fontes, tokens
  assets/css/tailwind.css     fonte do CSS (@tailwind + @layer components)
  assets/css/styles.css       CSS compilado (gerado; não editar à mão)
  assets/js/modelo.js         lê window.MODELO e preenche [data-modelo], links e o iframe do mapa
  assets/js/app.js            componentes Alpine + dados de exemplo (serviços, profissionais, horários)
  assets/img/favicon.svg
```

## Personalizar

1. **`config.js`**: nome, slogan, telefone, WhatsApp (só dígitos com DDI), e-mail, endereço, CNPJ, horários,
   `api` e coordenadas do mapa.
2. **Serviços, profissionais e horários de exemplo** ficam no topo de `assets/js/app.js` (`CATEGORIAS`,
   `SERVICOS`, `PROFISSIONAIS`, `SLOTS_EXEMPLO`). As abas e o stepper leem dali; o preço "R$ --" é placeholder
   de propósito.
3. **Galeria**: cada item é um `<button data-galeria-item data-titulo data-categoria>` com um SVG dentro. Para
   usar fotos reais, troque o SVG por `<img alt="…">` e ajuste `galeria.mostrar()` em `app.js` para clonar a
   imagem (uma linha).
4. **Textos** de hero, equipe, pacotes e localização ficam no `index.html`.
5. **Cores/fontes**: `tailwind.config.js` e o `<link>` do Google Fonts no `<head>`. Depois de mudar classes no
   HTML ou no JS, recompile o CSS (comando acima); o Tailwind só gera as classes que encontra nos arquivos de
   `content`.

## Integrações

- **API** (`MODELO.api` preenchido): etapa 4 busca `GET {api}/api/agenda/slots?data=AAAA-MM-DD&servico=<id>`;
  a etapa 5 envia `POST {api}/api/agenda` com `{origem: "estetica-salao", nome, telefone, servico, profissional,
  inicio, consentimento: true, site: ""}` (`profissional` é um campo extra deste modelo; o backend pode ignorar).
  `201` mostra o protocolo; `409` volta à etapa 4 com a mensagem de horário ocupado e recarrega a lista.
- **Sem API**: lista fixa de horários (domingo bloqueado se `horarios.dom` for "fechado") e envio por
  `https://wa.me/<whatsapp>` com a mensagem montada; sem WhatsApp, `mailto:`. A seção avisa "Demonstração sem
  servidor".
- **WhatsApp**: links com `data-modelo-href="whatsapp"`; número vazio esconde os elementos `data-whatsapp`.
- **Mapa**: iframe do OpenStreetMap com `loading="lazy"`; `modelo.js` monta o `bbox` a partir de `MODELO.mapa`.
- **Honeypot**: campo `site` fora da tela (classe `.honeypot`); preenchido, o front finge sucesso.

## Limites conhecidos

- Alpine avalia expressões com `new Function`, o que exige `'unsafe-eval'` numa CSP estrita. Para CSP sem eval,
  use a build `@alpinejs/csp` (sintaxe mais restrita) ou troque por JS vanilla.
- O JSON-LD é estático: não lê o `config.js`.
- Com CDN fora do ar, o site renderiza (CSS é local), mas abas, galeria e stepper não funcionam. Para total
  independência, copie o `cdn.min.js` do Alpine para `assets/js/` e aponte o `<script>` para ele.
- Sem backend, a lista de horários é ilustrativa e não há verificação de conflito.
- Os valores "R$ --" e os trabalhos da galeria são exemplos; nada aqui é dado real.

## Como testar

```bash
python tools/qa.py --modelo estetica-salao
```

Confere, em 390 e 1440 px: rolagem horizontal, erros de console, `lang`, viewport, `<title>`, description, um só
`<h1>`, landmarks, link "pular para o conteúdo", JSON-LD, canonical, Open Graph, `alt` nas imagens, ausência de
handlers e scripts inline. Grava as capturas em `docs/img/estetica-salao-{desktop,mobile}.png`.

Teste manual sugerido: trocar as abas com ← →; abrir um item da galeria e navegar com ← → e Esc; percorrer o
stepper até o fim tentando avançar sem escolher (erro por etapa) e confirmar (abre o WhatsApp).
