# Convenções dos modelos

Vale para todo modelo em `modelos/<slug>/`. Quem cria um modelo novo segue isto; o `tools/qa.py` confere parte
disso automaticamente.

## Propósito

Mostrar, com código real e publicável, como construímos sites para negócios locais: cada modelo cobre um nicho
procurado (clínica, estética, restaurante, imobiliária, advocacia, serviços residenciais) e usa uma **técnica
diferente** de propósito, para que o repositório funcione como catálogo de abordagens e não como seis variações
do mesmo template.

## Regras de conteúdo

- **Sem identidade real.** Nomes, telefones, endereços, pessoas e depoimentos são fictícios e claramente
  genéricos. Telefone sempre no formato `(00) 00000-0000`; endereço `Rua Exemplo, 123 · Bairro · Cidade/UF`;
  e-mail `contato@exemplo.com.br`. Nenhuma marca, cliente ou produto da TN Costa aparece dentro do modelo.
- **Depoimentos e números são exemplos.** Blocos de depoimento recebem a marcação visível "exemplo" (ex.: no
  `<figcaption>`), e nenhum número de resultado é inventado como se fosse real ("+500 clientes" não entra).
- **Português do Brasil** em texto, comentários e nomes de arquivo. Nomes de variável podem ficar em inglês
  quando forem convenção da plataforma (`localStorage`, `fetch`, atributos HTML).
- **Sem imagens externas nem binários.** Fotos viram ilustrações SVG inline, gradientes ou padrões CSS. Cada
  modelo deve funcionar aberto do disco (`file://`) e no GitHub Pages sem nenhum serviço externo além dos CDNs
  permitidos abaixo.
- **Dependências externas**, só quando a técnica do modelo pede, sempre com versão fixa e `integrity` quando o
  CDN oferecer: Tailwind (compilado localmente, não o CDN de desenvolvimento), Alpine.js, Leaflet. Nada de jQuery,
  nada de bundle gigante. Google Fonts é permitido (uma família por modelo, `preconnect`, `font-display: swap`),
  com fallback de sistema declarado.

## Estrutura mínima de um modelo

```
modelos/<slug>/
  README.md        técnica usada, estrutura, como personalizar, integrações, limites conhecidos
  index.html       página principal (ou src/ + build.py no modelo gerado)
  config.js        TUDO que muda de cliente para cliente: nome, telefone, WhatsApp, endereço, horários, API
  assets/css/…     estilos próprios do modelo
  assets/js/…      scripts próprios (sem handlers inline no HTML; sem <script> inline, para CSP)
  assets/img/…     SVGs
```

`config.js` expõe um único objeto global:

```js
window.MODELO = {
  nome: "Clínica Exemplo",
  telefone: "(00) 00000-0000",
  whatsapp: "5500000000000",          // só dígitos, com DDI; vazio esconde os botões de WhatsApp
  endereco: "Rua Exemplo, 123 · Bairro · Cidade/UF",
  horarios: { seg_sex: "08:00–18:00", sab: "08:00–12:00", dom: "fechado" },
  api: "",                            // base da API (ex.: "https://api.exemplo.com.br"); vazio = modo sem backend
  mapa: { lat: -1.455, lng: -48.49 }  // quando houver mapa
};
```

O HTML lê `MODELO` e preenche os pontos marcados com `data-modelo="nome"`, `data-modelo="telefone"` etc.
(um script `assets/js/modelo.js` por modelo, pequeno). Trocar de cliente = editar `config.js`.

## Formulários e backend

Todo formulário segue o mesmo contrato, implementado em `backend/` (FastAPI):

| Uso | Método e rota | Corpo (JSON) | Resposta |
|---|---|---|---|
| Lead / contato / orçamento | `POST {api}/api/leads` | `{origem, nome, telefone, email?, mensagem?, consentimento: true, site: ""}` | `201 {id, protocolo}` |
| Horários livres | `GET {api}/api/agenda/slots?data=AAAA-MM-DD&servico=<id>` | | `200 {data, slots: ["09:00", …]}` |
| Agendar | `POST {api}/api/agenda` | `{origem, nome, telefone, servico, inicio: "AAAA-MM-DDTHH:MM", consentimento: true, site: ""}` | `201 {id, protocolo}`; `409` se o horário acabou de ser ocupado |

- `origem` é o slug do modelo. `site` é o **honeypot**: campo invisível que humano não preenche; o backend
  descarta em silêncio quando vier preenchido (responde 201 falso, para não ensinar o robô).
- `consentimento` é a caixa LGPD, obrigatória e **desmarcada por padrão**, com texto curto dizendo para que o
  dado será usado.
- **Modo sem backend** (`MODELO.api` vazio, que é o caso do GitHub Pages): o envio vira um link do WhatsApp
  (`https://wa.me/<numero>?text=<mensagem montada com os campos>`) e, se não houver WhatsApp, `mailto:`. A
  interface avisa de forma discreta: "Demonstração sem servidor: a mensagem abre no WhatsApp".
- Erros de validação aparecem **ao lado do campo** (`aria-describedby`, `aria-invalid`), nunca em `alert()`.
- Depois de enviar: estado de sucesso claro, com o protocolo quando a API devolver.

## Acessibilidade (obrigatório)

- `<html lang="pt-BR">`, `<meta name="viewport">`, um único `<h1>`, landmarks (`header`, `nav`, `main`, `footer`),
  link "Pular para o conteúdo" como primeiro elemento focável.
- Todo controle interativo é alcançável e operável por teclado, com `:focus-visible` visível.
- Imagens decorativas com `alt=""` (ou `aria-hidden`); as informativas com `alt` descritivo.
- Contraste mínimo AA (4,5:1 em texto normal).
- `prefers-reduced-motion: reduce` desliga animações não essenciais.
- Componentes: menus, abas, acordeões, modais e carrosséis com os papéis e teclas esperados (ou usar
  elementos nativos: `<details>`, `<dialog>`).

## SEO e compartilhamento

- `<title>` e `<meta name="description">` específicos; `<link rel="canonical">` com placeholder
  `https://www.exemplo.com.br/`.
- Open Graph (`og:title`, `og:description`, `og:type`, `og:url`); sem `og:image` (não há imagem binária).
- JSON-LD do tipo certo (`Dentist`, `BeautySalon`, `Restaurant`, `RealEstateAgent`, `LegalService`,
  `HomeAndConstructionBusiness`) lendo os mesmos dados fictícios do `config.js` (pode ser estático no HTML).

## Desempenho

- Sem framework de UI pesado. Peso total de uma página (HTML + CSS + JS, sem fontes) abaixo de 300 KB.
- CSS e JS em arquivos próprios, `defer` nos scripts. Nada bloqueia a renderização além do CSS principal.
- `loading="lazy"` em iframes (mapa) e em qualquer `<img>` abaixo da dobra.

## Responsivo

- Funciona de 360 px a 1920 px. O `tools/qa.py` confere, em 390 e 1440 px, que `scrollWidth <= innerWidth`
  (sem rolagem horizontal), que não há erro no console e que os itens de acessibilidade/SEO acima existem.
- Menu colapsa em telas estreitas com botão acessível (`aria-expanded`, `aria-controls`).

## O README de cada modelo

Seções fixas: **Nicho e objetivo** · **Técnica** (o que este modelo demonstra e por quê) · **Estrutura** ·
**Personalizar** (o que editar em `config.js` e onde trocar textos) · **Integrações** (API, WhatsApp, mapa,
PWA…) · **Limites conhecidos** · **Como testar** (`python tools/qa.py --modelo <slug>`).

## Como validar antes de entregar

```bash
python tools/qa.py --modelo <slug>        # layout em 2 larguras, console, a11y/SEO básicos, capturas em docs/img/
```

Um modelo só está pronto quando o `qa.py` passa sem aviso e o README dele está completo.
