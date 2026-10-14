# Modelos de sites para negócios locais

[![CI](https://github.com/tncostatec/modelos-de-sites/actions/workflows/ci.yml/badge.svg)](https://github.com/tncostatec/modelos-de-sites/actions/workflows/ci.yml)
[![Pages](https://github.com/tncostatec/modelos-de-sites/actions/workflows/pages.yml/badge.svg)](https://tncostatec.github.io/modelos-de-sites/)
[![Licença MIT](https://img.shields.io/badge/licen%C3%A7a-MIT-green)](LICENSE)

Seis modelos de site, um por nicho procurado, cada um construído com uma **técnica diferente** de propósito, mais um
backend de formulários com testes. É o catálogo de como a TN Costa Tecnologia constrói sites para negócios locais:
não um template repetido seis vezes, mas seis respostas distintas para seis problemas distintos, todas sob o mesmo
controle de qualidade.

**Demonstrações ao vivo:** https://tncostatec.github.io/modelos-de-sites/

*English: six website templates for local-business niches (dental clinic, beauty salon, restaurant with delivery,
real-estate agency, law firm, home-repair services), each deliberately built with a different technique (modern
vanilla HTML/CSS/JS, compiled Tailwind + Alpine.js, installable PWA, URL-state catalogue with Leaflet map,
dependency-free Python static-site generator, multi-step conversion landing), plus a tested FastAPI backend for leads
and appointments with webhook relay. Every page passes an automated layout/accessibility/SEO check in CI.
Documentation is in Portuguese.*

## Os modelos

| Nicho | Nome fictício | Técnica demonstrada | Demo | Código |
|---|---|---|---|---|
| Clínica odontológica | Clínica Sorriso Pleno | Vanilla moderno: HTML semântico, CSS com custom properties e `color-mix()`, `<dialog>` e `<details>` nativos, agenda com horários vindos da API | [abrir](https://tncostatec.github.io/modelos-de-sites/modelos/clinica-odontologica/) | [`modelos/clinica-odontologica`](modelos/clinica-odontologica) |
| Salão de beleza e estética | Ateliê Belle | Tailwind CSS **compilado** localmente + Alpine.js: abas, galeria com lightbox, agendamento em etapas | [abrir](https://tncostatec.github.io/modelos-de-sites/modelos/estetica-salao/) | [`modelos/estetica-salao`](modelos/estetica-salao) |
| Restaurante com delivery | Cantina Nonna Rosa | PWA instalável: manifest, service worker (shell em cache, cardápio network-first), cardápio em JSON, carrinho em `localStorage`, pedido via WhatsApp | [abrir](https://tncostatec.github.io/modelos-de-sites/modelos/restaurante-delivery/) | [`modelos/restaurante-delivery`](modelos/restaurante-delivery) |
| Imobiliária | Imobiliária Marco Zero | Catálogo client-side: filtros com estado na URL, rota de detalhe por hash, favoritos, mapa Leaflet com os resultados, formulário de interesse | [abrir](https://tncostatec.github.io/modelos-de-sites/modelos/imobiliaria/) | [`modelos/imobiliaria`](modelos/imobiliaria) |
| Escritório de advocacia | Andrade & Lima Advocacia | Site multipágina gerado por um **gerador estático próprio em Python** (zero dependências): layout comum, blog em Markdown, sitemap, canonical e JSON-LD por página | [abrir](https://tncostatec.github.io/modelos-de-sites/modelos/advocacia/site/) | [`modelos/advocacia`](modelos/advocacia) |
| Reformas e reparos residenciais | Prumo Reformas e Reparos | Landing de conversão: orçamento em 3 etapas com validação por passo, rascunho na sessão, honeypot e time-trap, barra fixa de contato no celular, comparador antes/depois acessível | [abrir](https://tncostatec.github.io/modelos-de-sites/modelos/servicos-residenciais/) | [`modelos/servicos-residenciais`](modelos/servicos-residenciais) |

Nomes, telefones, endereços, pessoas e depoimentos são **fictícios** (ver `CONVENCOES.md`). Nas demonstrações o
backend está desligado: os formulários abrem o WhatsApp com a mensagem montada, que é o modo "sem servidor" previsto
em todos os modelos.

### Por que os nichos

Não existe ranking público de "quem mais encomenda site", mas as fontes convergem nos serviços locais: salões,
consultórios odontológicos, prestadores de serviços residenciais, imobiliárias, restaurantes e serviços profissionais
aparecem como os segmentos que mais dependem de presença local e de captação pelo site
([Templatery](https://templatery.com/best-small-business-website-templates/),
[roundup da Framer](https://yoframer.com/roundups/best-free-business-framer-templates-2026/),
[Squarespace via Cybernews](https://website-builders.cybernews.com/the-best-website-templates-of-2026-a-curated-review/)).

## Backend

[`backend/`](backend) é uma API pequena em **FastAPI + SQLite** que atende todos os formulários com o mesmo contrato:

- `POST /api/leads` (contato, orçamento, interesse) e `POST /api/agenda` + `GET /api/agenda/slots` (horários livres).
- Honeypot, consentimento LGPD gravado com hora e IP, validação com mensagens em português, limite por IP, CORS
  restrito, corrida de agendamento decidida por `UNIQUE` no banco, repasse por webhook (n8n, Make, CRM) em segundo
  plano com tentativas e sem derrubar o visitante.
- 15 testes sem rede (`pytest`), `Dockerfile` com usuário sem privilégio e `docker-compose` com rootfs somente leitura,
  `cap_drop: ALL`, `no-new-privileges` e teto de CPU, memória e PIDs.

Para ligar um modelo à API basta preencher `api` no `config.js` dele.

## Rodar localmente

```bash
git clone https://github.com/tncostatec/modelos-de-sites.git
cd modelos-de-sites
python modelos/advocacia/build.py          # gera modelos/advocacia/site/ (o único modelo com build)
python -m http.server 8080                 # http://localhost:8080/ abre a galeria
```

Backend (opcional):

```bash
cd backend && python -m venv .venv && .venv/Scripts/activate && pip install -r requirements.txt
uvicorn app.main:app --reload              # http://127.0.0.1:8000/api/docs
pytest -q
```

Aponte o `config.js` de um modelo para `api: "http://127.0.0.1:8000"` e os formulários passam a gravar e devolver
protocolo.

## Como cada modelo é verificado

`tools/qa.py` abre cada página num servidor local com Playwright, em **390 e 1440 px**, e reprova se houver rolagem
horizontal, erro no console, ou falta de: `lang="pt-BR"`, viewport, um único `h1`, `main`/`header`/`footer`, link
"pular para o conteúdo", `alt` em imagens, canonical, Open Graph, JSON-LD; também reprova script ou handler inline.
As capturas de tela da galeria saem do mesmo script.

```bash
pip install playwright && python -m playwright install chromium
python tools/qa.py                          # todos; --modelo <slug> para um; --sem-capturas no CI
```

O CI roda o `pytest` do backend e o `qa.py` a cada push; o workflow do Pages reconstrói o modelo multipágina e publica
a galeria.

## Usar um modelo para um cliente real

1. Copie a pasta do modelo e edite **só** `config.js` primeiro: nome, telefone, WhatsApp, endereço, horários, `api`.
2. Troque textos e as ilustrações SVG pelas fotos reais (com `alt` descritivo e peso controlado).
3. Suba o backend (ou aponte `api` para o seu) e configure `WEBHOOK_URL` para o n8n/CRM.
4. Publique como estático (GitHub Pages, Cloudflare Pages, Nginx). Para o modelo multipágina, rode o `build.py` antes.
5. Política de privacidade e texto de consentimento são do cliente; os modelos trazem o campo, não o texto jurídico.

Cada modelo tem um `README.md` com técnica, estrutura, personalização, integrações e limites conhecidos.
As regras comuns estão em [`CONVENCOES.md`](CONVENCOES.md).

## Licença e autor

MIT (ver `LICENSE`). **Tiago Costa** · [TN Costa Tecnologia](https://www.tncostatecnologia.com.br/) ·
[LinkedIn](https://www.linkedin.com/in/tiago-costa-7470587a) · [GitHub](https://github.com/tncostatec)
