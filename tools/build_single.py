#!/usr/bin/env python3
"""Gera uma versao do CaloriQuest em UM arquivo HTML (sprites em data URI).

Util para: publicar como pagina hospedada, mandar por WhatsApp/e-mail, ou
abrir direto do arquivo no celular sem servidor.

Uso: python3 tools/build_single.py [saida.html]
"""
import base64
import io
import os
import re
import sys

ROOT = os.path.join(os.path.dirname(__file__), "..")


def read(path):
    return io.open(os.path.join(ROOT, path), encoding="utf-8").read()


def b64(path):
    with open(os.path.join(ROOT, path), "rb") as f:
        return "data:image/png;base64," + base64.b64encode(f.read()).decode()


def build():
    css = read("css/style.css")
    foods = read("js/foods.js")
    calc = read("js/calc.js")
    challenges = read("js/challenges.js")
    mascots = read("js/mascots.js")
    game = read("js/game.js")
    sync = read("js/sync.js")
    app = read("js/app.js")
    html = read("index.html")

    sprites = {n: b64(f"assets/sprites/{n}.png")
               for n in ("walker_m", "walker_f", "ground", "hills", "cloud1", "cloud2",
                         "sun", "storm", "icon-192", "char_m", "char_f",
                         "dog", "cat", "mascot_dog", "mascot_cat")}

    # game.js: carrega dos data URIs em vez de arquivos
    game = game.replace('const base = "assets/sprites/";', "")
    game = game.replace('loadImage(base + n + ".png")', "loadImage(SPRITE_DATA[n])")

    # app.js: sem service worker; previews de personagem viram data URI
    app = app.replace('''  if ("serviceWorker" in navigator)
    navigator.serviceWorker.register("sw.js").catch(() => {});
''', "")
    app = app.replace(
        'const CHAR_PREVIEWS = { m: "assets/sprites/char_m.png", f: "assets/sprites/char_f.png" };',
        f'const CHAR_PREVIEWS = {{ m: SPRITE_DATA.char_m, f: SPRITE_DATA.char_f }};')

    # corpo da pagina (entre <body> e os <script src>)
    body = html.split("<body>")[1].split("<script")[0]
    body = body.replace('src="assets/sprites/icon-192.png"', f'src="{sprites["icon-192"]}"')
    body = body.replace('src="assets/sprites/char_m.png"', f'src="{sprites["char_m"]}"')
    body = body.replace('src="assets/sprites/mascot_dog.png"', f'src="{sprites["mascot_dog"]}"')
    body = body.replace('src="assets/sprites/mascot_cat.png"', f'src="{sprites["mascot_cat"]}"')

    sprite_js = "const SPRITE_DATA = {" + ",".join(
        f'{n}:"{d}"' for n, d in sprites.items() if n != "icon-192") + "};"

    out = f"""<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#7fc4f2">
<title>CaloriQuest</title>
<style>
{css}
</style>
{body}
<script>
{sprite_js}
{foods}
{calc}
{challenges}
{mascots}
{game}
{sync}
{app}
</script>
"""
    dest = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "dist", "caloriquest.html")
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    io.open(dest, "w", encoding="utf-8").write(out)
    print(f"gerado: {dest} ({os.path.getsize(dest) // 1024} KB)")


if __name__ == "__main__":
    build()
