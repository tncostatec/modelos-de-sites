# -*- coding: utf-8 -*-
"""Gerador estático do modelo "advocacia": zero dependências, só biblioteca padrão.

    python modelos/advocacia/build.py        # roda de qualquer diretório; gera modelos/advocacia/site/

O que ele faz:
  1. Lê src/layout.html (cabeçalho, menu, rodapé, JSON-LD LegalService) com os placeholders
     {{titulo}}, {{descricao}}, {{canonical}}, {{conteudo}}, {{raiz}}, {{og_type}} e {{jsonld_extra}}.
  2. Lê src/paginas/*.html (metadados entre "---" no topo + HTML do miolo) e gera uma pasta por página
     com index.html dentro, exceto index.html, que fica na raiz.
  3. Lê src/posts/*.md (front matter: titulo, data, resumo, slug) e converte o Markdown mínimo
     (títulos, parágrafos, listas, negrito, itálico, links, citação) para blog/<slug>/index.html com
     JSON-LD Article + BreadcrumbList.
  4. Gera blog/index.html a partir de src/paginas/blog.html, trocando {{lista_posts}} pelos cartões dos
     posts, do mais novo para o mais antigo (o mesmo placeholder vale para qualquer página).
  5. Escreve sitemap.xml e robots.txt e copia assets/ e config.js para site/.

Caminhos relativos: toda referência interna usa {{raiz}}, que vira "./", "../" ou "../../" conforme a
profundidade da página gerada. Assim o site abre de file://, do GitHub Pages em subcaminho e de
qualquer domínio sem mexer em nada. O canonical, por sua vez, é absoluto (BASE_URL + caminho bonito).
"""
from __future__ import annotations

import datetime as dt
import html
import json
import pathlib
import re
import shutil
import sys

AQUI = pathlib.Path(__file__).resolve().parent
SRC = AQUI / "src"
SAIDA = AQUI / "site"

BASE_URL = "https://www.exemplo.com.br/"        # placeholder; trocar pelo domínio real no deploy
NOME = "Andrade & Lima Advocacia"
MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro",
         "outubro", "novembro", "dezembro"]


# ---------------------------------------------------------------- utilidades de texto

def ler(caminho: pathlib.Path) -> str:
    return caminho.read_text(encoding="utf-8").replace("\r\n", "\n")


def front_matter(texto: str) -> tuple[dict[str, str], str]:
    """Bloco "chave: valor" entre linhas "---" no topo do arquivo. Devolve (meta, corpo)."""
    if not texto.startswith("---"):
        return {}, texto
    fim = texto.find("\n---", 3)
    if fim < 0:
        raise SystemExit(f"front matter sem fechamento ('---') em: {texto[:60]!r}")
    meta: dict[str, str] = {}
    for linha in texto[3:fim].strip().splitlines():
        if ":" in linha:
            chave, valor = linha.split(":", 1)
            meta[chave.strip()] = valor.strip()
    return meta, texto[fim + 4:].lstrip("\n")


def data_extenso(iso: str) -> str:
    d = dt.date.fromisoformat(iso)
    return f"{d.day} de {MESES[d.month - 1]} de {d.year}"


def inline(texto: str) -> str:
    """Marcação dentro de uma linha: **negrito**, *itálico*, [texto](url). Escapa HTML antes."""
    texto = html.escape(texto, quote=False)
    texto = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", texto)
    texto = re.sub(r"\*(\S(?:[^*]*?\S)?)\*", r"<em>\1</em>", texto)
    texto = re.sub(r"\[([^\]]+)\]\(([^)\s]+)\)", r'<a href="\2">\1</a>', texto)
    return texto


def markdown(texto: str) -> str:
    """Conversor mínimo: títulos (#), parágrafos, listas (- e 1.), citações (>) e marcação inline."""
    saida: list[str] = []
    paragrafo: list[str] = []
    lista: str | None = None

    def fechar_paragrafo() -> None:
        if paragrafo:
            saida.append(f"<p>{inline(' '.join(paragrafo))}</p>")
            paragrafo.clear()

    def fechar_lista() -> None:
        nonlocal lista
        if lista:
            saida.append(f"</{lista}>")
            lista = None

    def abrir_lista(tipo: str) -> None:
        nonlocal lista
        if lista != tipo:
            fechar_lista()
            lista = tipo
            saida.append(f"<{tipo}>")

    for linha in texto.split("\n"):
        s = linha.strip()
        if not s:
            fechar_paragrafo()
            fechar_lista()
            continue
        if m := re.match(r"^(#{1,6})\s+(.*)$", s):
            fechar_paragrafo()
            fechar_lista()
            nivel = len(m.group(1))
            saida.append(f"<h{nivel}>{inline(m.group(2))}</h{nivel}>")
        elif m := re.match(r"^[-*]\s+(.*)$", s):
            fechar_paragrafo()
            abrir_lista("ul")
            saida.append(f"<li>{inline(m.group(1))}</li>")
        elif m := re.match(r"^\d+[.)]\s+(.*)$", s):
            fechar_paragrafo()
            abrir_lista("ol")
            saida.append(f"<li>{inline(m.group(1))}</li>")
        elif s.startswith(">"):
            fechar_paragrafo()
            fechar_lista()
            saida.append(f"<blockquote><p>{inline(s.lstrip('> '))}</p></blockquote>")
        else:
            fechar_lista()
            paragrafo.append(s)
    fechar_paragrafo()
    fechar_lista()
    return "\n".join(saida)


def minutos_de_leitura(texto: str) -> int:
    return max(1, round(len(texto.split()) / 200))


# ---------------------------------------------------------------- montagem de páginas

def raiz_para(caminho_relativo: str) -> str:
    """'index.html' -> './' ; 'equipe/index.html' -> '../' ; 'blog/x/index.html' -> '../../'."""
    profundidade = caminho_relativo.count("/")
    return "./" if profundidade == 0 else "../" * profundidade


def montar(layout: str, *, caminho: str, titulo: str, descricao: str, conteudo: str, ativo: str,
           og_type: str = "website", jsonld_extra: str = "") -> str:
    raiz = raiz_para(caminho)
    canonical = BASE_URL + caminho.removesuffix("index.html")
    pagina = layout
    for chave, valor in {
        "titulo": html.escape(titulo, quote=True),
        "descricao": html.escape(descricao, quote=True),
        "canonical": canonical,
        "og_type": og_type,
        "jsonld_extra": jsonld_extra,
        "conteudo": conteudo,            # antes de {{raiz}}, para o miolo também ganhar o prefixo
    }.items():
        pagina = pagina.replace("{{" + chave + "}}", valor)
    pagina = pagina.replace("{{raiz}}", raiz)
    # item ativo do menu: o layout marca cada link com data-pagina="<nome>"
    pagina = pagina.replace(f'data-pagina="{ativo}"', f'data-pagina="{ativo}" aria-current="page"', 1)
    sobras = re.findall(r"{{\w+}}", pagina)
    if sobras:
        raise SystemExit(f"{caminho}: placeholders sem valor: {sorted(set(sobras))}")
    return pagina


def escrever(caminho: str, conteudo: str) -> None:
    destino = SAIDA / caminho
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(conteudo, encoding="utf-8", newline="\n")


def cartoes_de_posts(posts: list[dict]) -> str:
    itens = []
    for p in posts:
        itens.append(
            '<li class="post-cartao">\n'
            f'  <time datetime="{p["data"]}">{data_extenso(p["data"])}</time>\n'
            f'  <h3><a href="{{{{raiz}}}}blog/{p["slug"]}/index.html">{html.escape(p["titulo"])}</a></h3>\n'
            f'  <p>{html.escape(p["resumo"])}</p>\n'
            '  <span class="post-cartao-leia" aria-hidden="true">Ler artigo →</span>\n'
            "</li>"
        )
    return "\n".join(itens)


def jsonld_post(p: dict, canonical: str) -> str:
    artigo = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": p["titulo"],
        "description": p["resumo"],
        "datePublished": p["data"],
        "dateModified": p["data"],
        "inLanguage": "pt-BR",
        "author": {"@type": "Organization", "name": NOME},
        "publisher": {"@type": "Organization", "name": NOME},
        "mainEntityOfPage": canonical,
    }
    trilha = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Início", "item": BASE_URL},
            {"@type": "ListItem", "position": 2, "name": "Blog", "item": BASE_URL + "blog/"},
            {"@type": "ListItem", "position": 3, "name": p["titulo"], "item": canonical},
        ],
    }
    return "\n".join(
        f'<script type="application/ld+json">{json.dumps(obj, ensure_ascii=False)}</script>'
        for obj in (artigo, trilha)
    )


def html_do_post(p: dict) -> str:
    return f"""<article class="artigo">
  <header class="cabecalho-pagina cabecalho-artigo">
    <div class="secao-interno">
      <nav class="trilha" aria-label="Você está aqui">
        <ol>
          <li><a href="{{{{raiz}}}}index.html">Início</a></li>
          <li><a href="{{{{raiz}}}}blog/index.html">Blog</a></li>
          <li aria-current="page">{html.escape(p["titulo"])}</li>
        </ol>
      </nav>
      <p class="olho"><time datetime="{p["data"]}">{data_extenso(p["data"])}</time><span class="olho-extra">leitura de {p["minutos"]} min</span></p>
      <h1>{html.escape(p["titulo"])}</h1>
      <p class="cabecalho-texto">{html.escape(p["resumo"])}</p>
    </div>
  </header>
  <div class="secao">
    <div class="secao-interno artigo-interno">
      <p class="aviso"><strong>Conteúdo informativo.</strong> Este artigo explica conceitos gerais e não substitui a consulta com um advogado sobre o seu caso.</p>
      <div class="artigo-corpo">
{p["corpo"]}
      </div>
      <aside class="artigo-chamada" aria-label="Fale conosco">
        <p>Quer conversar sobre a sua situação?</p>
        <a class="botao botao-tinta" href="{{{{raiz}}}}contato/index.html">Agendar uma consulta</a>
      </aside>
    </div>
  </div>
</article>"""


# ---------------------------------------------------------------- programa principal

def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):      # console do Windows em cp1252 não imprime acento
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    layout = ler(SRC / "layout.html")

    # posts: do mais novo para o mais antigo
    posts: list[dict] = []
    for arquivo in sorted((SRC / "posts").glob("*.md")):
        meta, corpo = front_matter(ler(arquivo))
        faltando = {"titulo", "data", "resumo", "slug"} - meta.keys()
        if faltando:
            raise SystemExit(f"{arquivo.name}: faltam no front matter: {sorted(faltando)}")
        dt.date.fromisoformat(meta["data"])  # valida a data cedo
        posts.append({**meta, "corpo": markdown(corpo), "minutos": minutos_de_leitura(corpo)})
    posts.sort(key=lambda p: p["data"], reverse=True)
    lista_posts = cartoes_de_posts(posts)

    if SAIDA.exists():          # pasta gerada; é apagada e refeita a cada build
        shutil.rmtree(SAIDA)
    SAIDA.mkdir()

    gerados: list[tuple[str, str]] = []  # (caminho, lastmod) para o sitemap
    hoje = dt.date.today().isoformat()

    paginas = sorted((SRC / "paginas").glob("*.html"), key=lambda a: (a.stem != "index", a.stem))  # index primeiro
    for arquivo in paginas:
        nome = arquivo.stem
        meta, miolo = front_matter(ler(arquivo))
        caminho = "index.html" if nome == "index" else f"{nome}/index.html"
        miolo = miolo.replace("{{lista_posts}}", lista_posts)
        escrever(caminho, montar(layout, caminho=caminho, titulo=meta["titulo"], descricao=meta["descricao"],
                                 conteudo=miolo, ativo=meta.get("menu", nome)))
        gerados.append((caminho, hoje))

    for p in posts:
        caminho = f"blog/{p['slug']}/index.html"
        canonical = BASE_URL + f"blog/{p['slug']}/"
        escrever(caminho, montar(layout, caminho=caminho, titulo=f"{p['titulo']} · Blog · {NOME}",
                                 descricao=p["resumo"], conteudo=html_do_post(p), ativo="blog",
                                 og_type="article", jsonld_extra=jsonld_post(p, canonical)))
        gerados.append((caminho, p["data"]))

    urls = "\n".join(
        f"  <url><loc>{BASE_URL}{c.removesuffix('index.html')}</loc><lastmod>{d}</lastmod></url>"
        for c, d in gerados
    )
    escrever("sitemap.xml", f'<?xml version="1.0" encoding="UTF-8"?>\n'
                            f'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{urls}\n</urlset>\n')
    escrever("robots.txt", f"User-agent: *\nAllow: /\n\nSitemap: {BASE_URL}sitemap.xml\n")

    shutil.copytree(AQUI / "assets", SAIDA / "assets")
    shutil.copy2(AQUI / "config.js", SAIDA / "config.js")

    print(f"{len(gerados)} páginas geradas em {SAIDA.relative_to(AQUI.parent.parent)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
