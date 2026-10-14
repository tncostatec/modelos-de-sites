# -*- coding: utf-8 -*-
"""QA automático dos modelos: layout em duas larguras, console limpo, itens básicos de acessibilidade e SEO,
e capturas de tela para a galeria.

    python tools/qa.py                      # todos os modelos (lê tools/modelos.json)
    python tools/qa.py --modelo clinica-odontologica
    python tools/qa.py --sem-capturas       # só as checagens

Serve a raiz do repositório num servidor HTTP local (Playwright + Chromium), porque `file://` esconde
problemas de caminho relativo e de fetch. Sai com código 1 se qualquer checagem falhar.
"""
from __future__ import annotations

import argparse
import json
import pathlib
import subprocess
import sys
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

RAIZ = pathlib.Path(__file__).resolve().parent.parent
LISTA = RAIZ / "tools" / "modelos.json"
IMG = RAIZ / "docs" / "img"
LARGURAS = {"desktop": (1440, 900), "mobile": (390, 844)}
PORTA = 8765

CHECAGENS_JS = """() => {
  const q = (s) => document.querySelector(s);
  const problemas = [];
  if (document.documentElement.scrollWidth > window.innerWidth + 1)
    problemas.push(`rolagem horizontal: scrollWidth ${document.documentElement.scrollWidth} > ${window.innerWidth}`);
  if ((document.documentElement.getAttribute('lang') || '').toLowerCase() !== 'pt-br') problemas.push('html[lang] != pt-BR');
  if (!q('meta[name="viewport"]')) problemas.push('sem meta viewport');
  if (!document.title.trim()) problemas.push('sem <title>');
  if (!q('meta[name="description"]')) problemas.push('sem meta description');
  if (document.querySelectorAll('h1').length !== 1) problemas.push(`h1: ${document.querySelectorAll('h1').length} (esperado 1)`);
  if (!q('main')) problemas.push('sem <main>');
  if (!q('header') || !q('footer')) problemas.push('sem header/footer');
  if (!q('a[href^="#"].pular, a.skip-link, a[href="#conteudo"], a[href="#main"], a[href="#principal"]')) problemas.push('sem link "pular para o conteúdo"');
  if (!q('script[type="application/ld+json"]')) problemas.push('sem JSON-LD');
  if (!q('link[rel="canonical"]')) problemas.push('sem canonical');
  if (!q('meta[property="og:title"]')) problemas.push('sem og:title');
  for (const img of document.querySelectorAll('img')) if (!img.hasAttribute('alt')) { problemas.push('img sem alt'); break; }
  for (const el of document.querySelectorAll('[onclick],[onsubmit],[onchange],[oninput]')) { problemas.push('handler inline no HTML'); break; }
  if (q('script:not([src])') && !q('script[type="application/ld+json"]:only-of-type')) {
    const inl = [...document.querySelectorAll('script:not([src])')].filter(s => s.type !== 'application/ld+json' && s.type !== 'application/json');
    if (inl.length) problemas.push(`${inl.length} <script> inline (CSP)`);
  }
  const foco = [...document.querySelectorAll('a[href],button,input,select,textarea,[tabindex]')].filter(e => !e.hidden);
  if (!foco.length) problemas.push('nenhum elemento focável');
  return problemas;
}"""


class Silencioso(SimpleHTTPRequestHandler):
    def log_message(self, *a):  # noqa: D401
        pass


def servir() -> ThreadingHTTPServer:
    # porta 0 = o sistema escolhe uma livre; permite várias instâncias do qa.py ao mesmo tempo
    srv = ThreadingHTTPServer(("127.0.0.1", 0), lambda *a, **k: Silencioso(*a, directory=str(RAIZ), **k))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--modelo", help="slug de um modelo; sem isso roda todos os de tools/modelos.json")
    ap.add_argument("--sem-capturas", action="store_true")
    a = ap.parse_args()

    modelos = json.loads(LISTA.read_text(encoding="utf-8"))
    if a.modelo:
        modelos = [m for m in modelos if m["slug"] == a.modelo] or [{"slug": a.modelo, "paginas": [f"modelos/{a.modelo}/index.html"]}]

    from playwright.sync_api import sync_playwright

    srv = servir()
    time.sleep(0.5)
    falhas = 0
    try:
        with sync_playwright() as p:
            nav = p.chromium.launch()
            for m in modelos:
                for pagina in m["paginas"]:
                    for nome, (w, h) in LARGURAS.items():
                        ctx = nav.new_context(viewport={"width": w, "height": h}, locale="pt-BR",
                                              reduced_motion="reduce")
                        pg = ctx.new_page()
                        erros: list[str] = []
                        pg.on("console", lambda msg: erros.append(msg.text) if msg.type == "error" else None)
                        pg.on("pageerror", lambda e: erros.append(str(e)))
                        url = f"http://127.0.0.1:{srv.server_address[1]}/{pagina}"
                        pg.goto(url, wait_until="networkidle")
                        pg.wait_for_timeout(400)
                        problemas = pg.evaluate(CHECAGENS_JS)
                        # 404 de recursos próprios (css/js/svg que não existem)
                        problemas += [f"console: {e[:120]}" for e in erros]
                        rotulo = f"{pagina} @ {nome}"
                        if problemas:
                            falhas += 1
                            print(f"FALHA  {rotulo}")
                            for pr in problemas:
                                print(f"       - {pr}")
                        else:
                            print(f"ok     {rotulo}")
                        if not a.sem_capturas and pagina == m["paginas"][0]:  # só a 1ª página vira captura da galeria
                            IMG.mkdir(parents=True, exist_ok=True)
                            (IMG / "completo").mkdir(exist_ok=True)
                            if nome == "desktop":
                                # miniatura leve (viewport, JPEG) para a galeria; página inteira só para revisão (fora do git)
                                pg.screenshot(path=str(IMG / f"{m['slug']}-thumb.jpg"), type="jpeg", quality=72)
                                pg.screenshot(path=str(IMG / "completo" / f"{m['slug']}-desktop.png"), full_page=True)
                            else:
                                pg.screenshot(path=str(IMG / f"{m['slug']}-mobile.png"))
                        ctx.close()
            nav.close()
    finally:
        srv.shutdown()
    print(f"\n{'TUDO OK' if not falhas else f'{falhas} página(s) com problema'}")
    return 1 if falhas else 0


if __name__ == "__main__":
    sys.exit(main())
