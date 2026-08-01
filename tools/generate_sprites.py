#!/usr/bin/env python3
"""Gera os sprites em pixel art do CaloriQuest (PNGs reais, sem HTML/CSS art).

Saida em assets/sprites/:
  walker.png      - sprite sheet do personagem: 3 linhas (walk, run, sad) x 4 frames
  ground.png      - tile da pista/caminho
  hills.png       - tile dos morros com arvores (parallax)
  cloud1.png, cloud2.png, sun.png, storm.png
  icon-192.png, icon-512.png
  preview.png     - montagem ampliada para conferencia
"""
import os
import random
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "sprites")
os.makedirs(OUT, exist_ok=True)

# ---------- paleta ----------
OUTLINE = (26, 22, 38, 255)
SKIN = (232, 160, 108, 255)
SKIN_SH = (201, 127, 78, 255)
HAIR = (58, 42, 28, 255)
SHIRT = (224, 72, 72, 255)
SHIRT_SH = (176, 54, 54, 255)
SHORTS = (48, 80, 160, 255)
SHORTS_SH = (36, 64, 126, 255)
SHOE = (245, 245, 245, 255)
SHOE_SH = (190, 190, 200, 255)

FW, FH = 44, 52          # tamanho de cada frame
GROUND_Y = 49            # linha do chao dentro do frame


def brush(d, x1, y1, x2, y2, w, color):
    """Segmento grosso desenhado como pincel redondo (para bracos/pernas)."""
    steps = max(abs(x2 - x1), abs(y2 - y1), 1)
    for i in range(int(steps) + 1):
        t = i / steps
        x = x1 + (x2 - x1) * t
        y = y1 + (y2 - y1) * t
        r = w / 2
        d.ellipse([x - r, y - r, x + r, y + r], fill=color)


def add_outline(img):
    """Contorno pixel-art: dilata o alpha e pinta a borda escura."""
    a = img.split()[3]
    dil = a.filter(ImageFilter.MaxFilter(3))
    outline_mask = Image.eval(dil, lambda p: 255 if p > 40 else 0)
    base_mask = Image.eval(a, lambda p: 255 if p > 40 else 0)
    edge = Image.composite(
        Image.new("L", a.size, 255), Image.new("L", a.size, 0), outline_mask
    )
    inner = Image.composite(
        Image.new("L", a.size, 255), Image.new("L", a.size, 0), base_mask
    )
    from PIL import ImageChops

    ring = ImageChops.subtract(edge, inner)
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    out.paste(Image.new("RGBA", img.size, OUTLINE), (0, 0), ring)
    out.alpha_composite(img)
    return out


def draw_character(pose):
    """Desenha um frame do personagem virado para a direita.

    pose: dict com
      legF, legB : (dx do pe, lift do pe)   [frente/tras]
      armSwing   : dx da mao (bracos opostos as pernas)
      bob        : deslocamento vertical do corpo
      lean       : inclinacao para frente (px)
      headDrop   : cabeca abaixada (px), sad
      run        : bool (bracos dobrados)
      sad        : bool (postura caida)
    """
    img = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    cx = 20 + pose.get("lean", 0)
    bob = pose.get("bob", 0)
    hip_y = 33 + bob
    sad = pose.get("sad", False)

    # ----- pernas (atras do corpo: perna de tras mais escura) -----
    for which, shade in (("legB", True), ("legF", False)):
        dx, lift = pose[which]
        foot_x = cx + dx
        foot_y = GROUND_Y - lift
        knee_x = cx + dx * 0.45
        knee_y = hip_y + (foot_y - hip_y) * 0.5 - (2 if lift > 0 else 0)
        col_leg = SKIN_SH if shade else SKIN
        col_short = SHORTS_SH if shade else SHORTS
        brush(d, cx, hip_y, knee_x, knee_y, 5, col_short)      # coxa com bermuda
        brush(d, knee_x, knee_y, foot_x, foot_y - 2, 4, col_leg)  # canela
        # tenis
        sc = SHOE_SH if shade else SHOE
        d.rectangle([foot_x - 2, foot_y - 3, foot_x + 4, foot_y], fill=sc)

    # ----- braco de tras -----
    sh_y = 22 + bob + (2 if sad else 0)
    swing = pose.get("armSwing", 0)
    if pose.get("run"):
        brush(d, cx - 1, sh_y, cx - 1 - swing * 0.4, sh_y + 5, 4, SHIRT_SH)
        brush(d, cx - 1 - swing * 0.4, sh_y + 5, cx - 1 - swing, sh_y + 3, 3, SKIN_SH)
    elif sad:
        brush(d, cx - 2, sh_y, cx - 3, sh_y + 10, 3, SKIN_SH)
    else:
        brush(d, cx - 1, sh_y, cx - 1 - swing, sh_y + 9, 3, SKIN_SH)

    # ----- corpo: bermuda, barriga de fora, camiseta curta -----
    belly_top = 20 + bob + (2 if sad else 0)
    # bermuda/quadril
    d.rounded_rectangle([cx - 7, hip_y - 4, cx + 7, hip_y + 3], 3, fill=SHORTS)
    d.rectangle([cx - 7, hip_y - 1, cx + 7, hip_y + 1], fill=SHORTS_SH)
    # barrigao (aparecendo embaixo da camiseta, saltando pra frente)
    d.ellipse([cx - 8, belly_top + 2, cx + 12, hip_y - 1], fill=SKIN)
    d.ellipse([cx - 6, belly_top + 5, cx + 10, hip_y - 2], fill=SKIN)
    d.ellipse([cx + 6, belly_top + 5, cx + 12, hip_y - 3], fill=SKIN)
    # umbigo
    d.point((cx + 6, hip_y - 6), fill=SKIN_SH)
    d.point((cx + 7, hip_y - 6), fill=SKIN_SH)
    # camiseta curta (levantada por causa da barriga)
    d.rounded_rectangle([cx - 8, belly_top - 3, cx + 9, belly_top + 4], 3, fill=SHIRT)
    d.rectangle([cx - 8, belly_top + 2, cx + 9, belly_top + 4], fill=SHIRT_SH)
    # manga
    d.ellipse([cx - 4, belly_top - 3, cx + 8, belly_top + 3], fill=SHIRT)

    # ----- cabeca -----
    head_drop = pose.get("headDrop", 0)
    hx = cx + 3 + (2 if not sad else -1)
    hy = 12 + bob + head_drop
    d.ellipse([hx - 6, hy - 6, hx + 6, hy + 6], fill=SKIN)
    # cabelo
    d.ellipse([hx - 6, hy - 7, hx + 6, hy - 1], fill=HAIR)
    d.rectangle([hx - 6, hy - 4, hx - 3, hy + 1], fill=HAIR)
    if sad:
        # olho caido olhando pro chao
        d.point((hx + 3, hy + 2), fill=OUTLINE)
        d.line([hx + 1, hy + 5, hx + 4, hy + 5], fill=SKIN_SH)
    else:
        d.point((hx + 4, hy), fill=OUTLINE)
        # sorriso
        d.line([hx + 2, hy + 3, hx + 5, hy + 3], fill=SKIN_SH)
    # pescoco
    if hy + 5 < belly_top - 2:
        d.rectangle([cx + 1, hy + 5, cx + 5, belly_top - 2], fill=SKIN)

    # ----- braco da frente -----
    if pose.get("run"):
        # dobrado na altura do peito (pele sobre a camiseta = contraste)
        elbow_x, elbow_y = cx - 2, sh_y + 2
        fist_x, fist_y = cx + max(2, swing * 0.9), sh_y - 1
        brush(d, cx + 2, sh_y - 2, elbow_x, elbow_y, 3, SKIN)
        brush(d, elbow_x, elbow_y, fist_x, fist_y, 3, SKIN)
    elif sad:
        brush(d, cx + 2, sh_y, cx + 3, sh_y + 11, 3, SKIN)
    else:
        brush(d, cx + 2, sh_y, cx + 2 + swing, sh_y + 9, 3, SKIN)

    return add_outline(img)


# poses: (legF(dx,lift), legB(dx,lift), armSwing, bob)
WALK = [
    {"legF": (5, 0), "legB": (-4, 0), "armSwing": -4, "bob": 0},
    {"legF": (2, 2), "legB": (-1, 0), "armSwing": -1, "bob": -1},
    {"legF": (-4, 0), "legB": (5, 0), "armSwing": 4, "bob": 0},
    {"legF": (-1, 0), "legB": (2, 2), "armSwing": 1, "bob": -1},
]
RUN = [
    {"legF": (7, 1), "legB": (-6, 2), "armSwing": -6, "bob": -1, "lean": 2, "run": True},
    {"legF": (3, 4), "legB": (-2, 0), "armSwing": -2, "bob": -2, "lean": 2, "run": True},
    {"legF": (-6, 2), "legB": (7, 1), "armSwing": 6, "bob": -1, "lean": 2, "run": True},
    {"legF": (-2, 0), "legB": (3, 4), "armSwing": 2, "bob": -2, "lean": 2, "run": True},
]
SAD = [
    {"legF": (3, 0), "legB": (-2, 0), "bob": 1, "lean": -1, "headDrop": 4, "sad": True},
    {"legF": (1, 1), "legB": (0, 0), "bob": 2, "lean": -1, "headDrop": 5, "sad": True},
    {"legF": (-2, 0), "legB": (3, 0), "bob": 1, "lean": -1, "headDrop": 4, "sad": True},
    {"legF": (0, 0), "legB": (1, 1), "bob": 2, "lean": -1, "headDrop": 5, "sad": True},
]


def make_sheet():
    sheet = Image.new("RGBA", (FW * 4, FH * 3), (0, 0, 0, 0))
    for row, frames in enumerate((WALK, RUN, SAD)):
        for col, pose in enumerate(frames):
            sheet.alpha_composite(draw_character(pose), (col * FW, row * FH))
    sheet.save(os.path.join(OUT, "walker.png"))
    return sheet


# ---------- cenario ----------
def make_ground():
    rnd = random.Random(7)
    w, h = 64, 20
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # grama
    d.rectangle([0, 0, w, 3], fill=(96, 168, 80, 255))
    for x in range(0, w, 2):
        if rnd.random() < 0.5:
            d.point((x, 3), fill=(72, 140, 62, 255))
        if rnd.random() < 0.3:
            d.point((x, 0), fill=(130, 196, 100, 255))
    # caminho de terra
    d.rectangle([0, 4, w, h], fill=(196, 152, 104, 255))
    d.rectangle([0, 4, w, 5], fill=(214, 172, 122, 255))
    for _ in range(26):
        x, y = rnd.randrange(w), rnd.randrange(7, h - 2)
        d.point((x, y), fill=(168, 126, 84, 255))
    for _ in range(10):
        x, y = rnd.randrange(w), rnd.randrange(7, h - 3)
        d.rectangle([x, y, x + 1, y], fill=(228, 196, 152, 255))
    # marcas brancas (sensacao de movimento)
    d.rectangle([6, 11, 14, 12], fill=(240, 236, 220, 255))
    d.rectangle([40, 15, 46, 16], fill=(240, 236, 220, 255))
    img.save(os.path.join(OUT, "ground.png"))
    return img


def make_hills():
    rnd = random.Random(3)
    w, h = 160, 56
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    far = (134, 178, 128, 255)
    near = (100, 152, 96, 255)
    tree = (56, 104, 66, 255)
    trunk = (92, 64, 44, 255)
    d.ellipse([-30, 18, 70, 80], fill=far)
    d.ellipse([60, 10, 190, 85], fill=far)
    d.ellipse([20, 30, 130, 95], fill=near)
    d.ellipse([110, 34, 220, 100], fill=near)
    d.ellipse([-40, 36, 40, 100], fill=near)
    for tx in (18, 52, 96, 132, 148):
        ty = 30 + rnd.randrange(8)
        d.rectangle([tx, ty + 10, tx + 1, ty + 14], fill=trunk)
        d.polygon([(tx - 4, ty + 11), (tx + 5, ty + 11), (tx, ty)], fill=tree)
        d.polygon([(tx - 3, ty + 7), (tx + 4, ty + 7), (tx, ty - 2)], fill=tree)
    img.save(os.path.join(OUT, "hills.png"))
    return img


def make_cloud(name, w, h, seed):
    rnd = random.Random(seed)
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for _ in range(5):
        bw = rnd.randrange(w // 3, w // 2 + 4)
        bh = rnd.randrange(h // 2, h - 2)
        x = rnd.randrange(0, w - bw)
        y = rnd.randrange(0, h - bh)
        d.ellipse([x, y, x + bw, y + bh], fill=(250, 250, 252, 255))
    d.ellipse([2, h // 2, w - 2, h - 1], fill=(226, 230, 238, 255))
    d.ellipse([w // 5, 1, w - w // 5, h - 3], fill=(250, 250, 252, 255))
    img.save(os.path.join(OUT, name))
    return img


def make_sun():
    s = 26
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    c = s // 2
    for ang in range(8):
        import math

        a = ang * math.pi / 4
        x2 = c + math.cos(a) * (c - 1)
        y2 = c + math.sin(a) * (c - 1)
        d.line([c, c, x2, y2], fill=(255, 208, 82, 255), width=2)
    d.ellipse([c - 8, c - 8, c + 8, c + 8], fill=(255, 224, 110, 255))
    d.ellipse([c - 6, c - 6, c + 6, c + 6], fill=(255, 236, 150, 255))
    img.save(os.path.join(OUT, "sun.png"))
    return img


def make_storm():
    w, h = 48, 26
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    dark = (78, 82, 102, 255)
    mid = (104, 110, 132, 255)
    d.ellipse([2, 8, 26, 24], fill=dark)
    d.ellipse([16, 4, 44, 22], fill=dark)
    d.ellipse([10, 1, 34, 16], fill=mid)
    d.ellipse([28, 8, 46, 20], fill=mid)
    # raio
    d.polygon([(22, 20), (27, 20), (24, 25), (28, 25), (20, 33), (23, 26), (19, 26)],
              fill=(255, 222, 90, 255))
    img = img.crop((0, 0, w, 34)) if img.size[1] < 34 else img
    big = Image.new("RGBA", (w, 34), (0, 0, 0, 0))
    big.alpha_composite(img, (0, 0))
    big.save(os.path.join(OUT, "storm.png"))
    return big


def make_icons(sheet):
    frame = sheet.crop((0, 0, FW, FH))  # walk frame 0
    for size in (192, 512):
        img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        # fundo ceu -> grama
        for y in range(size):
            t = y / size
            r = int(126 + (96 - 126) * max(0, t - 0.7) / 0.3) if t > 0.7 else 126
            g = int(200 + (168 - 200) * max(0, t - 0.7) / 0.3) if t > 0.7 else 200
            b = int(244 + (80 - 244) * max(0, t - 0.7) / 0.3) if t > 0.7 else 244
            d.line([0, y, size, y], fill=(r, g, b, 255))
        scale = size * 0.82 / FH
        cw, ch = int(FW * scale), int(FH * scale)
        c = frame.resize((cw, ch), Image.NEAREST)
        img.alpha_composite(c, ((size - cw) // 2, int(size * 0.94) - ch))
        img.save(os.path.join(OUT, f"icon-{size}.png"))


def make_preview(sheet, ground, hills):
    scale = 4
    w = FW * 4 * scale
    h = (FH * 3 + 40) * scale
    prev = Image.new("RGBA", (w, h), (150, 205, 245, 255))
    prev.alpha_composite(
        sheet.resize((sheet.width * scale, sheet.height * scale), Image.NEAREST), (0, 0)
    )
    gy = FH * 3 * scale
    g = ground.resize((ground.width * scale, ground.height * scale), Image.NEAREST)
    for x in range(0, w, g.width):
        prev.alpha_composite(g, (x, gy))
    prev.save(os.path.join(OUT, "preview.png"))


if __name__ == "__main__":
    sheet = make_sheet()
    ground = make_ground()
    hills = make_hills()
    make_cloud("cloud1.png", 34, 14, 11)
    make_cloud("cloud2.png", 26, 11, 29)
    make_sun()
    make_storm()
    make_icons(sheet)
    make_preview(sheet, ground, hills)
    print("sprites gerados em", os.path.abspath(OUT))
