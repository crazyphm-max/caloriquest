#!/usr/bin/env python3
"""Processa os sprite sheets gerados por IA e monta os sheets do jogo.

Entrada: 8 PNGs (4 animacoes x 2 personagens) com fundo cinza gradiente.
Passos: remove fundo -> separa frames por projecao de colunas -> escolhe 6 ->
normaliza escala/pes/centro -> monta walker_m.png / walker_f.png (6 col x 4
linhas: walk, run, sad, idle) + char_m/char_f.png + icones.

Uso: python3 tools/process_ai_sprites.py <pasta_com_os_8_pngs>
"""
import os
import sys
from PIL import Image, ImageChops, ImageFilter, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "sprites")

# nome do arquivo de origem -> (personagem, animacao, frames na imagem)
SOURCES = {
    "87949c68-1000972399.png": ("m", "walk", 7),
    "84fadbb5-1000972406.png": ("m", "run", 7),
    "670a3dd0-1000972393.png": ("m", "sad", 6),
    "9671eef0-1000972407.png": ("m", "idle", 7),
    "c3dee178-1000972405.png": ("f", "walk", 6),
    "b50cea88-1000972408.png": ("f", "run", 7),
    "4b273d54-1000972409.png": ("f", "sad", 6),
    "f74e11e9-1000972410.png": ("f", "idle", 7),
}

ROW_ORDER = ["walk", "run", "sad", "idle"]
FW, FH = 80, 96          # frame final
FRAMES = 6
CHAR_H = 80              # altura alvo do personagem dentro do frame
BASELINE = 92            # y dos pés dentro do frame
BG_DIST = 48             # distância (Chebyshev) mínima do fundo p/ ser personagem


def remove_background(img):
    """Fundo = gradiente suave; estima a cor por linha usando as bordas
    laterais e mantém só o que estiver longe dela."""
    w, h = img.size
    rgb = img.convert("RGB")
    left = rgb.crop((0, 0, 40, h))
    right = rgb.crop((w - 40, 0, w, h))
    borders = Image.new("RGB", (80, h))
    borders.paste(left, (0, 0))
    borders.paste(right, (40, 0))
    row_bg = borders.resize((1, h), Image.BOX).resize((w, h), Image.NEAREST)

    diff = ImageChops.difference(rgb, row_bg)
    r, g, b = diff.split()
    dist = ImageChops.lighter(r, ImageChops.lighter(g, b))  # máx dos canais
    mask = dist.point(lambda p: 255 if p > BG_DIST else 0)

    # sombras projetadas = fundo escurecido (~72%); remove o que estiver perto
    shadow_bg = row_bg.point(lambda p: int(p * 0.72))
    diff2 = ImageChops.difference(rgb, shadow_bg)
    r2, g2, b2 = diff2.split()
    dist2 = ImageChops.lighter(r2, ImageChops.lighter(g2, b2))
    not_shadow = dist2.point(lambda p: 255 if p > 28 else 0)
    mask = ImageChops.multiply(mask, not_shadow)

    mask = mask.filter(ImageFilter.MedianFilter(5))         # tira ruído/brilho
    # abertura: quebra pontes finas (respingos presos por 1-2 px)
    mask = mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))

    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    out.paste(rgb, (0, 0), mask)
    return out, mask


def split_frames(mask, count):
    """Divide o conteúdo em `count` frames, cortando nos vales de densidade
    (funciona mesmo quando os frames se encostam)."""
    w, h = mask.size
    col = mask.resize((w, 1), Image.BOX)  # média por coluna
    data = list(col.getdata())
    xs = [x for x, v in enumerate(data) if v > 2]
    x0, x1 = xs[0], xs[-1] + 1
    step = (x1 - x0) / count
    cuts = [x0]
    for i in range(1, count):
        nominal = round(x0 + i * step)
        lo, hi = max(x0, nominal - 30), min(x1, nominal + 30)
        best = min(range(lo, hi), key=lambda x: data[x])
        cuts.append(best)
    cuts.append(x1)
    return [(cuts[i], cuts[i + 1]) for i in range(count) if cuts[i + 1] - cuts[i] > 40]


def remove_gray_shadows(img):
    """Sombras chapadas são cinza-neutro (r~g~b em tom médio); o personagem
    sempre tem cor ou é bem claro/escuro. Apaga o cinza neutro do alpha."""
    r, g, b, a = img.split()
    maxc = ImageChops.lighter(r, ImageChops.lighter(g, b))
    minc = ImageChops.darker(r, ImageChops.darker(g, b))
    spread = ImageChops.subtract(maxc, minc)
    low_spread = spread.point(lambda p: 255 if p < 26 else 0)
    midtone = maxc.point(lambda p: 255 if 55 < p < 205 else 0)
    gray = ImageChops.multiply(low_spread, midtone)
    a = ImageChops.subtract(a, gray)
    return Image.merge("RGBA", (r, g, b, a))


def largest_component(img):
    """Mantém só o maior pedaço conexo (tira respingos e vizinhos cortados)."""
    w, h = img.size
    alpha = list(img.split()[3].get_flattened_data()) if hasattr(img.split()[3], "get_flattened_data") else list(img.split()[3].getdata())
    solid = [1 if p > 40 else 0 for p in alpha]
    label = [0] * (w * h)
    best, best_size, cur = 0, 0, 0
    from collections import deque
    for start in range(w * h):
        if solid[start] and not label[start]:
            cur += 1
            size = 0
            q = deque([start])
            label[start] = cur
            while q:
                i = q.popleft()
                size += 1
                x, y = i % w, i // w
                for nx, ny in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
                    if 0 <= nx < w and 0 <= ny < h:
                        j = ny * w + nx
                        if solid[j] and not label[j]:
                            label[j] = cur
                            q.append(j)
            if size > best_size:
                best, best_size = cur, size
    keep = bytes(255 if l == best else 0 for l in label)
    keep_img = Image.frombytes("L", (w, h), keep)
    r, g, b, a = img.split()
    a = ImageChops.multiply(a, keep_img)
    return Image.merge("RGBA", (r, g, b, a))


def pick_evenly(items, n):
    if len(items) <= n:
        return items
    idx = [round(i * (len(items) - 1) / (n - 1)) for i in range(n)]
    return [items[i] for i in idx]


def process_sheet(path, count):
    img = Image.open(path).convert("RGBA")
    cut, mask = remove_background(img)
    frames = []
    for x0, x1 in split_frames(mask, count):
        frame = cut.crop((x0, 0, x1, img.size[1]))
        bbox = frame.getbbox()
        if not bbox:
            continue
        frame = frame.crop(bbox)
        frame = remove_gray_shadows(frame)
        frame = largest_component(frame)
        bbox = frame.getbbox()
        if bbox:
            frames.append(frame.crop(bbox))
    return pick_evenly(frames, FRAMES)


def harden_alpha(img):
    """Borda de pixel dura (sem franja meio transparente)."""
    r, g, b, a = img.split()
    a = a.point(lambda p: 255 if p > 110 else 0)
    out = Image.merge("RGBA", (r, g, b, a))
    return out


def compose(variant, anims):
    """anims: dict animacao -> lista de frames RGBA recortados."""
    # escala única por animação: maior frame vira CHAR_H
    sheet = Image.new("RGBA", (FW * FRAMES, FH * len(ROW_ORDER)), (0, 0, 0, 0))
    for row, anim in enumerate(ROW_ORDER):
        frames = anims[anim]
        max_h = max(f.height for f in frames)
        scale = CHAR_H / max_h
        for col, f in enumerate(frames):
            nw, nh = max(1, round(f.width * scale)), max(1, round(f.height * scale))
            small = harden_alpha(f.resize((nw, nh), Image.LANCZOS))
            x = col * FW + (FW - nw) // 2
            y = row * FH + BASELINE - nh
            sheet.alpha_composite(small, (max(0, x), max(0, y)))
    sheet.save(os.path.join(OUT, f"walker_{variant}.png"))
    return sheet


def make_char_preview(sheet, variant):
    frame = sheet.crop((0, FH * 3, FW, FH * 4))  # idle frame 0
    frame = frame.crop(frame.getbbox())
    big = frame.resize((frame.width * 2, frame.height * 2), Image.NEAREST)
    big.save(os.path.join(OUT, f"char_{variant}.png"))


def make_icons(sheet):
    frame = sheet.crop((0, 0, FW, FH))  # walk frame 0
    frame = frame.crop(frame.getbbox())
    for size in (192, 512):
        img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        for y in range(size):
            t = y / size
            if t < 0.72:
                col = (127, 196, 242)
            else:
                k = (t - 0.72) / 0.28
                col = (int(127 + (104 - 127) * k), int(196 + (168 - 196) * k),
                       int(242 + (84 - 242) * k))
            d.line([0, y, size, y], fill=col + (255,))
        scale = size * 0.84 / frame.height
        cw, ch = int(frame.width * scale), int(frame.height * scale)
        c = frame.resize((cw, ch), Image.LANCZOS)
        img.alpha_composite(c, ((size - cw) // 2, int(size * 0.96) - ch))
        img.save(os.path.join(OUT, f"icon-{size}.png"))


def make_debug(sheets):
    scale = 2
    w = FW * FRAMES * scale
    h = FH * len(ROW_ORDER) * len(sheets) * scale
    prev = Image.new("RGBA", (w, h), (150, 205, 245, 255))
    for i, sheet in enumerate(sheets):
        prev.alpha_composite(
            sheet.resize((sheet.width * scale, sheet.height * scale), Image.NEAREST),
            (0, i * FH * len(ROW_ORDER) * scale))
    prev.save(os.path.join(OUT, "preview.png"))


def main(src_dir):
    collected = {"m": {}, "f": {}}
    for fname, (variant, anim, count) in SOURCES.items():
        path = os.path.join(src_dir, fname)
        frames = process_sheet(path, count)
        print(f"{fname}: {variant}/{anim} -> {len(frames)} frames")
        collected[variant][anim] = frames

    sheets = []
    for variant in ("m", "f"):
        sheet = compose(variant, collected[variant])
        make_char_preview(sheet, variant)
        sheets.append(sheet)
    make_icons(sheets[0])
    make_debug(sheets)
    print("ok:", os.path.abspath(OUT))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ".")
