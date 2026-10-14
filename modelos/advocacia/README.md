# Advocacia · Andrade & Lima Advocacia

Site multipágina de escritório de advocacia, gerado por um **gerador estático próprio em Python**, sem
nenhuma dependência além da biblioteca padrão. Nome, pessoas, telefones e endereço são fictícios.

## Nicho e objetivo

Escritório de advocacia de pequeno porte (seis áreas, três advogados). O site precisa transmitir
credibilidade e levar o visitante a **agendar uma consulta**: formulário de contato, telefone, WhatsApp e
e-mail em todas as páginas.

O conteúdo respeita o espírito do Provimento 205/2021 da OAB: sem promessa de resultado, sem
superlativos ("o melhor"), sem depoimento de cliente, sem valor de honorários ou de causa. No lugar de
depoimentos entram "Como trabalhamos" e "Perguntas frequentes"; os artigos do blog são informativos e
trazem o aviso "não substitui consulta".

## Técnica

**Gerador estático em Python puro (`build.py`)**, para mostrar que um site com várias páginas, blog e
sitemap não exige framework nem Node: um layout, páginas de miolo, posts em Markdown e um script de
120 linhas que resolve tudo, inclusive os caminhos relativos.

O que o `build.py` faz, nesta ordem:

1. Lê `src/layout.html`: cabeçalho, menu, rodapé e JSON-LD `LegalService`. Placeholders: `{{titulo}}`,
   `{{descricao}}`, `{{canonical}}`, `{{conteudo}}`, `{{raiz}}`, `{{og_type}}` e `{{jsonld_extra}}`.
2. Lê `src/paginas/*.html`. Cada arquivo tem um bloco de metadados entre `---` no topo (`titulo`,
   `descricao` e, opcionalmente, `menu`) seguido do HTML do miolo. `index.html` vira a raiz; os demais
   viram `<nome>/index.html`.
3. Lê `src/posts/*.md` (front matter `titulo`, `data`, `resumo`, `slug`) e converte o Markdown mínimo:
   títulos (`#`), parágrafos, listas (`-` e `1.`), citações (`>`), `**negrito**`, `*itálico*` e
   `[links](url)`. Cada post vira `blog/<slug>/index.html` com breadcrumb, aviso de conteúdo informativo,
   tempo de leitura e JSON-LD `Article` + `BreadcrumbList`.
4. Substitui `{{lista_posts}}` (em qualquer página) pelos cartões dos posts, do mais novo para o mais
   antigo. É assim que `blog/index.html` e a seção "Do blog" da home são montadas.
5. Marca o item ativo do menu: cada link do layout tem `data-pagina="<nome>"`, e a página gerada ganha
   `aria-current="page"` no link correspondente (posts ativam "Blog").
6. Gera `sitemap.xml` (com `lastmod`) e `robots.txt`, e copia `assets/` e `config.js` para `site/`.

### Caminhos relativos

O site precisa abrir de `file://` e de um subcaminho do GitHub Pages (`/modelos-de-sites/modelos/advocacia/site/`),
então **nenhum caminho interno começa com `/`**. Toda referência no layout, nas páginas e nos posts usa
`{{raiz}}`, e o gerador calcula o prefixo pela profundidade do arquivo de saída:

| Página gerada | `{{raiz}}` |
|---|---|
| `index.html` | `./` |
| `equipe/index.html` | `../` |
| `blog/<slug>/index.html` | `../../` |

Os links internos apontam para `.../index.html` explicitamente (`equipe/index.html`, não `equipe/`), porque
`file://` não resolve diretório para índice. O `<link rel="canonical">` e o sitemap, por outro lado, usam a
URL absoluta e "bonita" (`https://www.exemplo.com.br/equipe/`), que é o que um servidor web entrega.

## Estrutura

```
modelos/advocacia/
  README.md
  build.py                  gerador (zero dependências); python modelos/advocacia/build.py
  config.js                 dados do cliente (window.MODELO); copiado para site/
  assets/
    css/estilo.css          estilos (EB Garamond nos títulos, pilha de sistema no corpo)
    js/modelo.js            preenche data-modelo="…" e os links de telefone/WhatsApp/e-mail/mapa
    js/pagina.js            menu colapsável (aria-expanded, Escape) e marcação html.js
    js/formulario.js        validação, honeypot, POST /api/leads ou WhatsApp/mailto
    img/favicon.svg
  src/
    layout.html             esqueleto comum
    paginas/                index, areas-de-atuacao, equipe, contato, blog
    posts/                  3 artigos em Markdown
  site/                     SAÍDA GERADA (apagada e refeita a cada build; não versionar)
```

Páginas geradas: `index.html`, `areas-de-atuacao/`, `equipe/`, `contato/`, `blog/`, `blog/<slug>/` (3),
`sitemap.xml`, `robots.txt`.

## Personalizar

- **Dados do cliente**: só `config.js` (nome, telefone, WhatsApp, e-mail, endereço, horários, API, mapa).
  O HTML lê `window.MODELO` e preenche os elementos com `data-modelo="telefone"`,
  `data-modelo="horarios.sab"` etc. Com `whatsapp` vazio, os botões de WhatsApp somem.
- **Textos**: `src/paginas/*.html` (miolo de cada página) e `src/layout.html` (menu, rodapé, nota da OAB).
  O JSON-LD `LegalService` do layout é estático e deve ser alinhado ao `config.js` quando trocar de cliente.
- **Domínio**: `BASE_URL` no topo do `build.py` (canonical, sitemap, robots).
- **Novo post**: criar `src/posts/<slug>.md` com o front matter e rodar o build. Entra no blog, na home e no
  sitemap sem mexer em mais nada.
- **Nova página**: criar `src/paginas/<nome>.html` com o bloco `---` no topo e, se quiser no menu, adicionar
  o link com `data-pagina="<nome>"` no layout.
- **Áreas**: a lista aparece em três lugares que precisam ficar alinhados: o sumário da home, a página
  `areas-de-atuacao.html` (ids das âncoras) e o `<select>` da página de contato (`?area=<id>` na URL
  pré-seleciona a opção; é o que os links "Falar sobre…" da página de áreas fazem).

## Integrações

- **Formulário de contato** (`contato/`): campos nome, telefone, e-mail (opcional), área, mensagem,
  consentimento LGPD (desmarcado por padrão) e honeypot `site`. Validação ao lado do campo
  (`aria-invalid`, `aria-describedby`, `aria-live`), máscara leve de telefone.
  - Com `MODELO.api` preenchido: `POST {api}/api/leads` com
    `{origem: "advocacia", nome, telefone, email?, mensagem, consentimento: true, site: ""}`; a resposta
    `201 {protocolo}` aparece no estado de sucesso.
  - Sem API (GitHub Pages): a interface avisa "Demonstração sem servidor" e o envio abre o WhatsApp
    (`wa.me/<numero>?text=…`) com a mensagem montada; sem WhatsApp, abre `mailto:`.
- **Mapa**: iframe do OpenStreetMap com `loading="lazy"`, montado pelo `modelo.js` a partir de
  `MODELO.mapa` (sem coordenadas, o bloco some).
- **Fonte**: EB Garamond via Google Fonts (`preconnect`, `display=swap`), com fallback Garamond/Times.
- **JSON-LD**: `LegalService` em todas as páginas; `Article` + `BreadcrumbList` nos posts.

## Limites conhecidos

- O conversor de Markdown é mínimo de propósito: não há tabelas, imagens, código, listas aninhadas nem
  HTML cru. Para esses casos, escrever a página em HTML em `src/paginas/`.
- Os links internos terminam em `index.html` (ver "Caminhos relativos"). Num servidor com reescrita de URL
  é possível trocar por caminhos limpos editando apenas o `build.py` e o layout.
- O menu colapsável depende de JavaScript; sem JS, os links continuam acessíveis em telas largas, mas no
  mobile o menu fica fechado (apenas o link "Agendar consulta" do rodapé e a navegação do rodapé funcionam).
- O `build.py` apaga `site/` antes de gerar. Não editar arquivos dentro de `site/`.
- Sem backend, o honeypot só "finge" o sucesso no navegador; a proteção real contra robôs é do `backend/`.

## Como testar

```bash
python modelos/advocacia/build.py            # gera site/ (funciona de qualquer diretório)
python tools/qa.py --modelo advocacia        # confere site/index.html e site/blog/index.html em 390 e 1440 px
```

Para ver no navegador sem servidor, abrir `modelos/advocacia/site/index.html` direto do disco.
