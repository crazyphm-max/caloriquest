#!/usr/bin/env python3
"""Gera os sprites do CaloriQuest em pixel art de alta definicao (estilo jogos
modernos: micropixels, rampas de cor, sombreamento e contornos suaves).

Saida em assets/sprites/:
  walker.png      - sprite sheet do personagem: 4 linhas (walk, run, sad, idle) x 6 frames
  ground.png      - tile da pista/caminho
  hills.png       - tile dos morros com arvores (parallax)
  cloud1.png, cloud2.png, sun.png, storm.png
  icon-192.png, icon-512.png
  preview.png     - montagem ampliada para conferencia
"""
import math
import os
import random
from PIL import Image, ImageDraw, ImageFilter, ImageChops

OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "sprites")
os.makedirs(OUT, exist_ok=True)

# ---------- rampas de cor (hue-shift, como pixel art moderna) ----------
SKIN_HI = (247, 198, 148, 255)
SKIN = (232, 164, 110, 255)
SKIN_SH = (198, 126, 80, 255)
SKIN_DK = (152, 88, 58, 255)

SHIRT_HI = (255, 122, 102, 255)
SHIRT = (226, 80, 63, 255)
SHIRT_SH = (172, 52, 48, 255)
SHIRT_DK = (118, 32, 38, 255)

SHORT_HI = (98, 133, 214, 255)
SHORT = (61, 90, 168, 255)
SHORT_SH = (44, 65, 128, 255)
SHORT_DK = (30, 45, 92, 255)

HAIR_HI = (110, 78, 48, 255)
HAIR = (74, 51, 31, 255)
HAIR_SH = (48, 32, 17, 255)

SHOE = (245, 246, 250, 255)
SHOE_SH = (196, 202, 216, 255)
SHOE_DK = (142, 150, 170, 255)

BAND = (240, 196, 70, 255)      # faixa de suor na testa
BAND_SH = (198, 152, 44, 255)

OUTLINE = (26, 20, 34, 255)

FW, FH = 64, 88          # tamanho de cada frame
FRAMES = 6               # frames por animacao
GROUND_Y = 84            # linha do chao dentro do frame
CX = 30                  # centro do personagem


def brush(d, p1, p2, w, color):
    """Segmento grosso (pincel redondo) para membros."""
    x1, y1 = p1
    x2, y2 = p2
    steps = max(abs(x2 - x1), abs(y2 - y1), 1)
    for i in range(int(steps) + 1):
        t = i / steps
        x = x1 + (x2 - x1) * t
        y = y1 + (y2 - y1) * t
        r = w / 2
        d.ellipse([x - r, y - r, x + r, y + r], fill=color)


def ring_mask(img, thick=1):
    a = img.split()[3]
    solid = Image.eval(a, lambda p: 255 if p > 40 else 0)
    dil = solid.filter(ImageFilter.MaxFilter(1 + 2 * thick))
    return ImageChops.subtract(dil, solid)


def outline_part(part, color):
    """Contorno 1px na cor escura do proprio material (visual moderno)."""
    ring = ring_mask(part)
    out = Image.new("RGBA", part.size, (0, 0, 0, 0))
    out.paste(Image.new("RGBA", part.size, color), (0, 0), ring)
    out.alpha_composite(part)
    return out


def new_layer():
    return Image.new("RGBA", (FW, FH), (0, 0, 0, 0))


def clipped_shade(img, shape_box, shade_box, color):
    """Pinta 'color' na intersecao entre a elipse base e a elipse de sombra."""
    base = Image.new("L", img.size, 0)
    ImageDraw.Draw(base).ellipse(shape_box, fill=255)
    sh = Image.new("L", img.size, 0)
    ImageDraw.Draw(sh).ellipse(shade_box, fill=255)
    mask = ImageChops.multiply(base, sh)
    img.paste(Image.new("RGBA", img.size, color), (0, 0), mask)


def draw_character(pose):
    """Um frame do personagem (virado para a direita), em camadas com contorno
    por material + silhueta externa escura."""
    lean = pose.get("lean", 0)
    bob = pose.get("bob", 0)
    head_drop = pose.get("headDrop", 0)
    sad = pose.get("sad", False)
    idle = pose.get("idle", False)
    run = pose.get("run", False)
    breath = pose.get("breath", 0)
    swing = pose.get("armSwing", 0)

    cx = CX + lean
    hip_y = 58 + bob
    sy = 32 + bob + (2 if sad else 0)          # linha dos ombros
    belly_top = sy + 4

    fig = new_layer()

    # ---------- perna (bermuda curta: perna quase toda de pele) ----------
    def leg(ax, ay, shade):
        part = new_layer()
        d = ImageDraw.Draw(part)
        hipx, hipy = cx + 2, hip_y + 4
        knee_bias = 0 if idle else 3
        knee_x = hipx + (ax - hipx) * 0.5 + knee_bias
        knee_y = hipy + (ay - hipy) * 0.5 - (2 if ay < GROUND_Y - 3 else 0)
        thigh = SKIN_SH if shade else SKIN
        shin = SKIN_SH if shade else SKIN
        shin_dk = SKIN_DK if shade else SKIN_SH
        brush(d, (hipx, hipy), (knee_x, knee_y), 7, thigh)
        brush(d, (knee_x, knee_y), (ax, ay - 3), 6, shin)
        brush(d, (knee_x + 1, knee_y + 2), (ax + 2, ay - 3), 2, shin_dk)
        # meia + tenis
        sc, ss = (SHOE_SH, SHOE_DK) if shade else (SHOE, SHOE_SH)
        d.rectangle([ax - 3, ay - 6, ax + 3, ay - 4], fill=(240, 240, 244, 255) if not shade else SHOE_SH)
        d.rounded_rectangle([ax - 4, ay - 4, ax + 7, ay], 2, fill=sc)
        d.rectangle([ax - 4, ay - 1, ax + 7, ay], fill=ss)
        d.rectangle([ax + 4, ay - 4, ax + 7, ay - 3], fill=ss)  # bico
        return outline_part(part, SKIN_DK)

    fx, fy = pose["legF"]
    bx, by = pose["legB"]
    fig.alpha_composite(leg(cx + bx, GROUND_Y - by, True))

    def sleeve_toward(d, sh, target, w, color, hi):
        """Manga da camiseta: cobre o braco do ombro ate o cotovelo."""
        dx, dy = target[0] - sh[0], target[1] - sh[1]
        ln = max(1.0, math.hypot(dx, dy))
        end = (sh[0] + dx / ln * 5, sh[1] + dy / ln * 5)
        brush(d, (sh[0], sh[1] - 1), end, w, color)

    # ---------- braco de tras ----------
    armB = new_layer()
    da = ImageDraw.Draw(armB)
    sleeveB = new_layer()
    dsb = ImageDraw.Draw(sleeveB)
    shx, shy = cx - 7, sy + 1
    if run:
        elb = (shx - 3 - swing * 0.15, shy + 8)
        hnd = (shx + swing * 0.8, shy + 4)
        brush(da, (shx, shy), elb, 5, SKIN_SH)
        brush(da, elb, hnd, 4, SKIN_SH)
        da.ellipse([hnd[0] - 2, hnd[1] - 2, hnd[0] + 3, hnd[1] + 3], fill=SKIN)
        sleeve_toward(dsb, (shx, shy), elb, 5, SHIRT_SH, SHIRT)
    elif sad or idle:
        elb = (shx + 1, shy + 14)
        brush(da, (shx, shy), elb, 4, SKIN_SH)
        da.ellipse([elb[0] - 3, elb[1] - 2, elb[0] + 2, elb[1] + 3], fill=SKIN_SH)
        sleeve_toward(dsb, (shx, shy), elb, 5, SHIRT_SH, SHIRT)
    else:
        hnd = (shx - 2 - swing, shy + 13)
        brush(da, (shx, shy), hnd, 4, SKIN_SH)
        da.ellipse([hnd[0] - 2, hnd[1] - 2, hnd[0] + 3, hnd[1] + 3], fill=SKIN_SH)
        sleeve_toward(dsb, (shx, shy), hnd, 5, SHIRT_SH, SHIRT)
    fig.alpha_composite(outline_part(armB, SKIN_DK))
    fig.alpha_composite(sleeveB)

    # ---------- torso: barrigao + camiseta curta + bermuda curta ----------
    torso = new_layer()
    dt = ImageDraw.Draw(torso)

    # barrigao (bem redondo, saltando para a frente)
    belly_box = [cx - 14, belly_top - breath, cx + 17 + breath, hip_y + 4]
    dt.ellipse(belly_box, fill=SKIN)
    clipped_shade(torso, belly_box, [cx - 24, belly_top + 10, cx + 6, hip_y + 12], SKIN_SH)
    clipped_shade(torso, belly_box, [cx + 1, belly_top - 4 - breath, cx + 20 + breath, belly_top + 12], SKIN_HI)
    dt.rectangle([cx + 10, hip_y - 6, cx + 12, hip_y - 5], fill=SKIN_DK)  # umbigo

    # bermuda curta com listra branca (por cima da base da barriga)
    dt.rounded_rectangle([cx - 12, hip_y - 1, cx + 13, hip_y + 9], 4, fill=SHORT)
    dt.rectangle([cx - 12, hip_y + 6, cx + 13, hip_y + 9], fill=SHORT_SH)
    dt.rectangle([cx - 12, hip_y - 1, cx + 13, hip_y], fill=SHORT_HI)  # cos
    dt.rectangle([cx + 9, hip_y + 1, cx + 10, hip_y + 8], fill=(235, 238, 245, 255))  # listra

    # camiseta curta (barra levantada na frente: a barriga fica de fora)
    shirt_bot = belly_top + 9
    dt.rounded_rectangle([cx - 13, sy - 4, cx + 12, shirt_bot], 5, fill=SHIRT)
    dt.polygon([(cx - 13, shirt_bot), (cx + 12, shirt_bot - 5),
                (cx + 12, shirt_bot - 7), (cx - 13, shirt_bot - 3)], fill=SHIRT_SH)  # barra
    clipped_shade(torso, [cx - 13, sy - 4, cx + 12, shirt_bot],
                  [cx - 24, sy + 4, cx - 2, shirt_bot + 6], SHIRT_SH)
    dt.line([cx - 7, shirt_bot - 6, cx - 5, shirt_bot - 3], fill=SHIRT_SH)  # dobra
    dt.line([cx + 1, shirt_bot - 7, cx + 2, shirt_bot - 4], fill=SHIRT_SH)

    fig.alpha_composite(outline_part(torso, SHIRT_DK))

    # ---------- perna da frente ----------
    fig.alpha_composite(leg(cx + fx, GROUND_Y - fy, False))

    # ---------- cabeca ----------
    head = new_layer()
    dh = ImageDraw.Draw(head)
    hx = cx + 5 + (0 if not sad else -2)
    hy = 19 + bob + head_drop

    # pescoco
    dh.rectangle([cx - 1, hy + 6, cx + 7, sy + 1], fill=SKIN)
    dh.rectangle([cx - 1, hy + 8, cx + 2, sy + 1], fill=SKIN_SH)

    # rosto (papada arredondada)
    face_box = [hx - 10, hy - 9, hx + 11, hy + 11]
    dh.ellipse(face_box, fill=SKIN)
    clipped_shade(head, face_box, [hx - 16, hy + 2, hx + 4, hy + 16], SKIN_SH)
    clipped_shade(head, face_box, [hx + 1, hy - 12, hx + 14, hy + 2], SKIN_HI)

    # cabelo (topo/atras) + faixa de suor acima da testa
    dh.ellipse([hx - 10, hy - 10, hx + 10, hy - 4], fill=HAIR)
    dh.rectangle([hx - 10, hy - 7, hx - 6, hy + 6], fill=HAIR)
    dh.ellipse([hx - 9, hy - 10, hx + 4, hy - 6], fill=HAIR_HI)
    dh.rectangle([hx - 10, hy + 2, hx - 8, hy + 6], fill=HAIR_SH)
    dh.rectangle([hx - 8, hy - 6, hx + 10, hy - 4], fill=BAND)
    dh.rectangle([hx - 8, hy - 4, hx + 10, hy - 4], fill=BAND_SH)

    if sad:
        dh.line([hx + 4, hy + 1, hx + 7, hy + 1], fill=OUTLINE)          # olho fechado
        dh.line([hx + 3, hy - 2, hx + 7, hy - 1], fill=HAIR_SH)          # sobrancelha caida
        dh.arc([hx + 3, hy + 6, hx + 9, hy + 10], 180, 360, fill=SKIN_DK)  # boca triste
    else:
        blink = pose.get("blink", False)
        if blink:
            dh.line([hx + 4, hy + 1, hx + 7, hy + 1], fill=OUTLINE)
        else:
            dh.rectangle([hx + 4, hy - 1, hx + 6, hy + 2], fill=(252, 252, 252, 255))
            dh.rectangle([hx + 6, hy, hx + 7, hy + 2], fill=OUTLINE)
        dh.line([hx + 3, hy - 3, hx + 8, hy - 3], fill=HAIR_SH)          # sobrancelha
        dh.arc([hx + 2, hy + 3, hx + 9, hy + 8], 0, 180, fill=SKIN_DK)   # sorriso
    # nariz e orelha
    dh.rectangle([hx + 10, hy + 1, hx + 11, hy + 3], fill=SKIN_SH)
    dh.ellipse([hx - 4, hy + 1, hx - 0, hy + 6], fill=SKIN_SH)
    dh.point((hx - 2, hy + 3), fill=SKIN_DK)

    fig.alpha_composite(outline_part(head, SKIN_DK))

    # ---------- braco da frente ----------
    armF = new_layer()
    df = ImageDraw.Draw(armF)
    sleeveF = new_layer()
    dsf = ImageDraw.Draw(sleeveF)
    shx, shy = cx + 6, sy + 1
    if run:
        elb = (shx - 4 + swing * 0.15, shy + 8)
        hnd = (shx + swing, shy + 3)
        brush(df, (shx, shy), elb, 5, SKIN)
        brush(df, elb, hnd, 4, SKIN)
        df.ellipse([hnd[0] - 3, hnd[1] - 3, hnd[0] + 3, hnd[1] + 3], fill=SKIN_HI)
        sleeve_toward(dsf, (shx, shy), elb, 6, SHIRT, SHIRT_HI)
    elif sad or idle:
        elb = (shx + 4, shy + 13)
        brush(df, (shx, shy), elb, 4, SKIN)
        df.ellipse([elb[0] - 3, elb[1] - 1, elb[0] + 3, elb[1] + 5], fill=SKIN)
        sleeve_toward(dsf, (shx, shy), elb, 6, SHIRT, SHIRT_HI)
    else:
        hnd = (shx + 2 + swing, shy + 13)
        brush(df, (shx, shy), hnd, 4, SKIN)
        df.ellipse([hnd[0] - 3, hnd[1] - 2, hnd[0] + 3, hnd[1] + 4], fill=SKIN)
        sleeve_toward(dsf, (shx, shy), hnd, 6, SHIRT, SHIRT_HI)

    fig.alpha_composite(outline_part(armF, SKIN_DK))
    fig.alpha_composite(sleeveF)

    # ---------- silhueta externa ----------
    ring = ring_mask(fig)
    final = new_layer()
    final.paste(Image.new("RGBA", (FW, FH), OUTLINE), (0, 0), ring)
    final.alpha_composite(fig)
    return final


# ---------- poses geradas por fase (6 frames por ciclo) ----------
def walk_pose(i):
    t = i / FRAMES * 2 * math.pi
    stride = 9 * math.sin(t)
    lift = lambda th: 4 * max(0.0, math.sin(th + 1.1))
    return {
        "legF": (stride, lift(t)),
        "legB": (9 * math.sin(t + math.pi), lift(t + math.pi)),
        "armSwing": -6 * math.sin(t),
        "bob": round(-1.5 * (0.5 - 0.5 * math.cos(2 * t))),
    }


def run_pose(i):
    t = i / FRAMES * 2 * math.pi
    stride = 13 * math.sin(t)
    lift = lambda th: 7 * max(0.0, math.sin(th + 1.1))
    return {
        "legF": (stride, lift(t)),
        "legB": (13 * math.sin(t + math.pi), lift(t + math.pi)),
        "armSwing": -10 * math.sin(t),
        "bob": round(-2.5 * (0.5 - 0.5 * math.cos(2 * t))),
        "lean": 4,
        "run": True,
    }


def sad_pose(i):
    t = i / FRAMES * 2 * math.pi
    stride = 5 * math.sin(t)
    lift = lambda th: 1.5 * max(0.0, math.sin(th + 1.1))
    return {
        "legF": (stride, lift(t)),
        "legB": (5 * math.sin(t + math.pi), lift(t + math.pi)),
        "bob": 2,
        "lean": -2,
        "headDrop": 4,
        "sad": True,
    }


def idle_pose(i):
    t = i / FRAMES * 2 * math.pi
    return {
        "legF": (4, 0),
        "legB": (-5, 0),
        "idle": True,
        "breath": round(1.5 * max(0.0, math.sin(t))),
        "bob": round(-1 * max(0.0, math.sin(t))),
        "blink": i == 4,
    }


def make_sheet():
    rows = [walk_pose, run_pose, sad_pose, idle_pose]
    sheet = Image.new("RGBA", (FW * FRAMES, FH * len(rows)), (0, 0, 0, 0))
    for r, posef in enumerate(rows):
        for c in range(FRAMES):
            sheet.alpha_composite(draw_character(posef(c)), (c * FW, r * FH))
    sheet.save(os.path.join(OUT, "walker.png"))
    return sheet


# ---------- cenario ----------
def make_ground():
    rnd = random.Random(7)
    w, h = 128, 28
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # grama em dois tons + fios
    d.rectangle([0, 0, w, 5], fill=(104, 176, 84, 255))
    d.rectangle([0, 5, w, 6], fill=(76, 142, 62, 255))
    for x in range(0, w, 2):
        if rnd.random() < 0.5:
            d.point((x, rnd.randrange(0, 3)), fill=(140, 204, 106, 255))
        if rnd.random() < 0.35:
            d.line([x, 0, x, 1], fill=(88, 156, 70, 255))
    # terra com pedrinhas e variacao
    d.rectangle([0, 6, w, h], fill=(198, 154, 106, 255))
    d.rectangle([0, 6, w, 7], fill=(222, 182, 132, 255))
    for _ in range(60):
        x, y = rnd.randrange(w), rnd.randrange(9, h - 2)
        d.point((x, y), fill=(174, 130, 88, 255))
    for _ in range(18):
        x, y = rnd.randrange(w), rnd.randrange(10, h - 4)
        d.rectangle([x, y, x + rnd.randrange(1, 3), y + 1], fill=(226, 194, 150, 255))
        d.rectangle([x, y + 2, x + 1, y + 2], fill=(160, 118, 78, 255))
    for _ in range(8):
        x, y = rnd.randrange(w), rnd.randrange(12, h - 4)
        d.ellipse([x, y, x + 3, y + 2], fill=(150, 108, 70, 255))
    # marcas de distancia
    d.rectangle([12, 16, 26, 18], fill=(240, 236, 220, 255))
    d.rectangle([80, 21, 92, 23], fill=(240, 236, 220, 255))
    img.save(os.path.join(OUT, "ground.png"))
    return img


def make_hills():
    rnd = random.Random(3)
    w, h = 320, 110
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    far = (150, 190, 150, 255)      # morro distante (mais claro = atmosfera)
    mid = (112, 164, 110, 255)
    near = (86, 140, 88, 255)
    # camada distante
    d.ellipse([-60, 34, 140, 160], fill=far)
    d.ellipse([100, 22, 300, 170], fill=far)
    d.ellipse([240, 40, 420, 170], fill=far)
    # camada media
    d.ellipse([-80, 56, 90, 190], fill=mid)
    d.ellipse([50, 48, 230, 200], fill=mid)
    d.ellipse([180, 58, 380, 200], fill=mid)
    # camada proxima
    d.ellipse([-40, 76, 130, 220], fill=near)
    d.ellipse([90, 70, 300, 220], fill=near)
    d.ellipse([230, 80, 420, 220], fill=near)
    # pinheiros com dois tons
    tree_d = (44, 92, 58, 255)
    tree_l = (62, 118, 70, 255)
    trunk = (94, 66, 44, 255)
    for tx in (24, 70, 118, 168, 214, 262, 300):
        ty = 56 + rnd.randrange(16)
        d.rectangle([tx, ty + 18, tx + 2, ty + 24], fill=trunk)
        for lv, wd in ((0, 9), (7, 7), (13, 5)):
            d.polygon([(tx - wd + 1, ty + 19 - lv), (tx + wd + 1, ty + 19 - lv),
                       (tx + 1, ty + 2 - lv)], fill=tree_d)
            d.polygon([(tx - wd + 3, ty + 19 - lv), (tx + 1, ty + 19 - lv),
                       (tx + 1, ty + 5 - lv)], fill=tree_l)
    img.save(os.path.join(OUT, "hills.png"))
    return img


def make_cloud(name, w, h, seed):
    rnd = random.Random(seed)
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # base achatada + lobos fofos, dois tons
    d.ellipse([2, h * 0.45, w - 2, h - 1], fill=(224, 230, 240, 255))
    lobes = []
    x = 4
    while x < w - 12:
        lw = rnd.randrange(int(w * 0.28), int(w * 0.45))
        lh = rnd.randrange(int(h * 0.5), int(h * 0.8))
        y = rnd.randrange(0, max(1, int(h * 0.3)))
        lobes.append([x, y, min(w - 2, x + lw), y + lh])
        x += int(lw * 0.55)
    for box in lobes:
        d.ellipse(box, fill=(250, 251, 253, 255))
    for box in lobes:
        d.ellipse([box[0] + 2, box[1] + 1, box[2] - 2, box[1] + (box[3] - box[1]) * 0.6],
                  fill=(255, 255, 255, 255))
    img.save(os.path.join(OUT, name))
    return img


def make_sun():
    s = 44
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    c = s // 2
    d.ellipse([c - 20, c - 20, c + 20, c + 20], fill=(255, 214, 96, 70))
    d.ellipse([c - 15, c - 15, c + 15, c + 15], fill=(255, 220, 100, 140))
    for ang in range(8):
        a = ang * math.pi / 4 + 0.4
        x1 = c + math.cos(a) * 13
        y1 = c + math.sin(a) * 13
        x2 = c + math.cos(a) * 20
        y2 = c + math.sin(a) * 20
        d.line([x1, y1, x2, y2], fill=(255, 226, 120, 220), width=2)
    d.ellipse([c - 11, c - 11, c + 11, c + 11], fill=(255, 228, 120, 255))
    d.ellipse([c - 8, c - 8, c + 8, c + 8], fill=(255, 240, 168, 255))
    d.ellipse([c - 4, c - 6, c + 4, c + 2], fill=(255, 248, 208, 255))
    img.save(os.path.join(OUT, "sun.png"))
    return img


def make_storm():
    w, h = 76, 52
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    dark = (70, 74, 96, 255)
    mid = (98, 104, 128, 255)
    light = (128, 134, 158, 255)
    d.ellipse([2, 14, 40, 38], fill=dark)
    d.ellipse([24, 8, 68, 36], fill=dark)
    d.ellipse([46, 16, 74, 38], fill=dark)
    d.ellipse([12, 4, 48, 26], fill=mid)
    d.ellipse([40, 8, 70, 28], fill=mid)
    d.ellipse([18, 2, 44, 16], fill=light)
    d.rectangle([6, 30, 70, 36], fill=dark)
    # raio
    d.polygon([(34, 36), (42, 36), (38, 43), (44, 43), (31, 52), (36, 44), (30, 44)],
              fill=(255, 224, 96, 255))
    d.polygon([(35, 37), (39, 37), (36, 42), (37, 42), (34, 46)],
              fill=(255, 244, 170, 255))
    img.save(os.path.join(OUT, "storm.png"))
    return img


def make_icons(sheet):
    frame = sheet.crop((0, 0, FW, FH))  # walk frame 0
    for size in (192, 512):
        img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        for y in range(size):
            t = y / size
            if t < 0.72:
                col = (127, 196, 242)
            else:
                k = (t - 0.72) / 0.28
                col = (int(127 + (104 - 127) * k), int(196 + (176 - 196) * k),
                       int(242 + (84 - 242) * k))
            d.line([0, y, size, y], fill=col + (255,))
        scale = size * 0.86 / FH
        cw, ch = int(FW * scale), int(FH * scale)
        c = frame.resize((cw, ch), Image.NEAREST)
        img.alpha_composite(c, ((size - cw) // 2, int(size * 0.97) - ch))
        img.save(os.path.join(OUT, f"icon-{size}.png"))


def make_preview(sheet, ground, hills):
    scale = 3
    w = FW * FRAMES * scale
    h = (FH * 4 + 40) * scale
    prev = Image.new("RGBA", (w, h), (150, 205, 245, 255))
    prev.alpha_composite(
        sheet.resize((sheet.width * scale, sheet.height * scale), Image.NEAREST), (0, 0)
    )
    gy = FH * 4 * scale
    g = ground.resize((ground.width * scale, ground.height * scale), Image.NEAREST)
    for x in range(0, w, g.width):
        prev.alpha_composite(g, (x, gy))
    prev.save(os.path.join(OUT, "preview.png"))


if __name__ == "__main__":
    sheet = make_sheet()
    ground = make_ground()
    hills = make_hills()
    make_cloud("cloud1.png", 64, 24, 11)
    make_cloud("cloud2.png", 44, 18, 29)
    make_sun()
    make_storm()
    make_icons(sheet)
    make_preview(sheet, ground, hills)
    print("sprites gerados em", os.path.abspath(OUT))
