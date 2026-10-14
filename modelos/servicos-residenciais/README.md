# Serviços residenciais · Prumo Reformas e Reparos

Landing page de conversão para prestador de serviços residenciais (elétrica, hidráulica, pintura, reformas),
pensada para o celular: formulário de orçamento em três etapas, proteção anti-spam sem CAPTCHA e contato
em um toque. Nome, telefone, endereço, bairros e avaliações são fictícios.

## Nicho e objetivo

Pequena empresa de reparos e reformas que vive de pedidos rápidos. O site tem um único trabalho:
**transformar a visita em um pedido de orçamento**, de preferência em menos de um minuto e pelo celular.
Tudo na página aponta para isso: o formulário é o próprio hero, a barra fixa inferior oferece "Ligar" e
"WhatsApp", e cada cartão de serviço tem um "Pedir orçamento" que já pré-seleciona o serviço.

## Técnica

**Formulário em etapas com validação progressiva e anti-spam, sem framework** (HTML + CSS + JS puros):

- **Três etapas** (serviço → detalhes → contato) em `<fieldset data-etapa>`, com barra de progresso
  (`role="progressbar"`, `aria-valuenow`, `aria-valuetext`) e foco movido para a `<legend>` da etapa ao
  avançar, para leitores de tela saberem onde estão.
- **Validação por etapa**, mensagem ao lado do campo (`aria-invalid`, `aria-describedby`, `aria-live`), foco
  no primeiro campo inválido e revalidação ao digitar. Enter num campo de texto avança a etapa em vez de
  enviar o formulário incompleto.
- **Rascunho em `sessionStorage`**: serviço, urgência, descrição, bairro, nome e telefone sobrevivem a um
  recarregamento (o consentimento LGPD não é restaurado de propósito).
- **Anti-spam em duas camadas**: honeypot `site` (campo invisível; se vier preenchido, a interface finge
  sucesso e não envia) e **time-trap** (envio em menos de 3 s desde o carregamento é recusado com uma
  mensagem educada pedindo para tentar de novo).
- **Comparador antes/depois** com `<input type="range">` real (teclado, leitor de tela, `aria-valuetext`),
  duas cenas SVG sobrepostas e `clip-path: inset()` controlado por uma custom property; arrastar direto
  sobre a imagem espelha o controle (`touch-action: pan-y` preserva a rolagem vertical no celular).
- **Animações de entrada** com `IntersectionObserver`, ligadas só quando há JS (`html.js`) e
  `prefers-reduced-motion` não está ativo; sem JS, tudo fica visível.
- **Tipografia fluida** com `clamp()`, **custom properties** para cores e raios, e a fonte Archivo variável
  usando o eixo de largura (`font-stretch`) para títulos largos e rótulos condensados numa família só.
- Ícones em **sprite SVG inline** (`<symbol>` + `<use>`), sem arquivos externos.

## Estrutura

```
modelos/servicos-residenciais/
  README.md
  index.html                página única (hero + formulário, garantias, serviços, antes/depois,
                            como funciona, área de atendimento, avaliações, FAQ, rodapé, barra fixa)
  config.js                 dados do cliente (window.MODELO)
  assets/
    css/estilo.css          estilos (mobile-first; barra fixa < 60rem, botão flutuante ≥ 60rem)
    js/modelo.js            preenche data-modelo="…" e os links de telefone/WhatsApp/e-mail/mapa
    js/pagina.js            menu colapsável, animações de entrada, comparador antes/depois
    js/orcamento.js         formulário em etapas, rascunho, honeypot, time-trap, envio
    img/favicon.svg
```

## Personalizar

- **Dados do cliente**: só `config.js` (nome, telefone, WhatsApp, e-mail, endereço, horários, API, mapa).
  Com `whatsapp` vazio, os botões de WhatsApp (barra fixa, flutuante, hero, rodapé) somem sozinhos.
- **Serviços**: os seis cartões da seção "Serviços" e as seis opções da etapa 1 do formulário usam os mesmos
  nomes; o atributo `data-escolher="<nome>"` do cartão precisa bater com o `value` do rádio.
- **Bairros**: lista da seção "Onde atendemos", `<datalist id="lista-bairros">` do formulário e `areaServed`
  do JSON-LD. Os três devem ficar alinhados.
- **Mensagem consolidada** (WhatsApp/API): função `montarMensagem` em `assets/js/orcamento.js`.
- **Cenas do antes/depois**: dois `<svg class="cena">` em `index.html`; qualquer ilustração com o mesmo
  `viewBox` serve.
- **Avaliações**: trocar os três `<figure>` e remover a etiqueta "exemplo" só quando forem reais e autorizadas.
- **JSON-LD** (`HomeAndConstructionBusiness`): estático no `<head>`; alinhar ao `config.js` ao trocar de cliente.

## Integrações

- **Formulário de orçamento**: com `MODELO.api` preenchido, `POST {api}/api/leads` com
  `{origem: "servicos-residenciais", nome, telefone, mensagem, consentimento: true, site: ""}`; serviço,
  urgência, descrição e bairro vão dentro de `mensagem`, já formatados. A resposta `201 {protocolo}`
  aparece no estado de sucesso. Sem API (GitHub Pages), a interface avisa "Demonstração sem servidor" e o
  pedido abre no WhatsApp (`wa.me/<numero>?text=…`); sem WhatsApp, abre `mailto:`.
- **Barra fixa (mobile)**: `tel:` e `wa.me`, lidos do `config.js`. **Botão flutuante (desktop)**: WhatsApp.
- **Mapa**: iframe do OpenStreetMap com `loading="lazy"`, montado pelo `modelo.js` a partir de `MODELO.mapa`.
- **Fonte**: Archivo via Google Fonts (`preconnect`, `display=swap`), com fallback Helvetica/Arial.

## Limites conhecidos

- O time-trap conta a partir do carregamento da página. Quem recarrega com o rascunho restaurado na etapa 3
  e envia em menos de 3 s recebe o aviso e precisa tocar de novo; é o custo de não usar CAPTCHA.
- Sem backend, honeypot e time-trap só agem no navegador; a proteção real contra robôs é do `backend/`.
- O rascunho usa `sessionStorage`: some ao fechar a aba (intencional, para não guardar dados pessoais além
  da sessão).
- O comparador usa `clip-path: inset()` e `aspect-ratio`; em navegadores muito antigos as duas cenas
  aparecem sobrepostas sem corte (o `range` continua funcionando).
- As cenas do antes/depois são ilustrações vetoriais, não fotos (regra do repositório: sem binários).

## Como testar

```bash
python tools/qa.py --modelo servicos-residenciais   # 390 e 1440 px, console, a11y/SEO, capturas em docs/img/
```

Para ver no navegador sem servidor, abrir `modelos/servicos-residenciais/index.html` direto do disco.
Fluxo manual recomendado no celular: escolher um serviço, avançar com um campo vazio (ver mensagem),
completar, enviar antes de 3 s (ver aviso do time-trap), enviar de novo (abre o WhatsApp).
