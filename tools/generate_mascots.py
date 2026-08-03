#!/usr/bin/env python3
"""Gera os sprites dos mascotes do CaloriQuest em pixel art.

  dog.png  - cachorro: 3 linhas (skinny, normal, buff) x 4 frames de caminhada
  cat.png  - gato:     3 linhas (dry, normal, happy)   x 4 frames de caminhada
  mascot_dog.png / mascot_cat.png - retratos para a tela de Perfil

Cada linha e um estagio; o jogo troca de linha conforme proteina/agua do dia.
"""
import math
import os

from PIL import Image, ImageChops, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "sprites")
os.makedirs(OUT, exist_ok=True)

FW, FH = 56, 48       # frame do mascote (menor que o do humano)
FRAMES = 4
GROUND = 44           # linha do chao dentro do frame
OUTLINE = (26, 20, 34, 255)

# --- cachorro: caramelo brasileiro ---
DOG = {
    "hi": (226, 168, 96, 255), "mid": (198, 134, 68, 255),
    "sh": (156, 98, 48, 255), "dk": (108, 64, 32, 255),
    "belly": (240, 214, 172, 255),
    "collar": (214, 66, 66, 255), "collar_sh": (162, 44, 52, 255),
    "tag": (250, 208, 84, 255),
}
# --- gato: cinza rajado ---
CAT = {
    "hi": (176, 180, 196, 255), "mid": (142, 148, 168, 255),
    "sh": (108, 114, 136, 255), "dk": (72, 78, 100, 255),
    "belly": (226, 228, 238, 255),
    "collar": (86, 176, 168, 255), "collar_sh": (52, 126, 122, 255),
    "tag": (250, 208, 84, 255),
}


def brush(d, p1, p2, w, color):
    x1, y1 = p1
    x2, y2 = p2
    steps = max(abs(x2 - x1), abs(y2 - y1), 1)
    for i in range(int(steps) + 1):
        t = i / steps
        x, y = x1 + (x2 - x1) * t, y1 + (y2 - y1) * t
        r = w / 2
        d.ellipse([x - r, y - r, x + r, y + r], fill=color)


def outline_fig(fig):
    a = fig.split()[3]
    solid = Image.eval(a, lambda p: 255 if p > 40 else 0)
    ring = ImageChops.subtract(solid.filter(ImageFilter.MaxFilter(3)), solid)
    out = Image.new("RGBA", fig.size, (0, 0, 0, 0))
    out.paste(Image.new("RGBA", fig.size, OUTLINE), (0, 0), ring)
    out.alpha_composite(fig)
    return out


def draw_pet(kind, stage, i):
    """kind: 'dog' | 'cat'. stage: 0 = fraco/murcho, 1 = normal, 2 = forte/feliz."""
    C = DOG if kind == "dog" else CAT
    img = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    t = i / FRAMES * 2 * math.pi

    # proporcoes por estagio
    if kind == "dog":
        body_h = [8, 11, 15][stage]        # altura do tronco
        chest = [0, 2, 5][stage]           # peito estufado
        leg_w = [3, 4, 5][stage]
        head_r = 8
        droop = 0
    else:
        body_h = [8, 11, 12][stage]
        chest = [0, 1, 2][stage]
        leg_w = [3, 3, 4][stage]
        head_r = 7
        droop = [4, 1, 0][stage]           # gato murcho: corpo baixo, cabeca caida

    bob = -1 if (stage == 2 and i % 2 == 0) else 0
    if kind == "cat" and stage == 0:
        bob = 0
    body_y = GROUND - 12 - body_h // 2 + droop + bob
    cx = 26

    # ---- rabo ----
    tail_sw = math.sin(t) * (5 if stage == 2 else 3 if stage == 1 else 1)
    if kind == "dog":
        tail_top = body_y - 6 - (4 if stage == 2 else 2)
        brush(d, (cx - 12, body_y - 2), (cx - 17 + tail_sw * 0.4, tail_top), 4, C["mid"])
    else:
        # gato: rabo alto e curvo quando feliz, caido quando murcho
        if stage == 0:
            brush(d, (cx - 12, body_y), (cx - 19, GROUND - 3), 3, C["mid"])
        else:
            h = 12 if stage == 2 else 8
            for k in range(9):
                f = k / 8
                x = cx - 12 - 5 * math.sin(f * 2.2) + tail_sw * f * 0.5
                y = body_y - f * h
                d.ellipse([x - 1.5, y - 1.5, x + 1.5, y + 1.5], fill=C["mid"])

    # ---- patas de tras ----
    for side, col in ((-1, C["sh"]), (1, C["mid"])):
        phase = t if side > 0 else t + math.pi
        fx = cx - 9 + math.sin(phase) * (4 if stage else 3)
        brush(d, (cx - 9, body_y + body_h // 2), (fx, GROUND - 2), leg_w, col)
        d.ellipse([fx - 3, GROUND - 3, fx + 3, GROUND], fill=col)

    # ---- tronco ----
    d.rounded_rectangle([cx - 13, body_y - body_h // 2 - chest // 2,
                         cx + 12, body_y + body_h // 2], body_h // 2, fill=C["mid"])
    # peito/lombo claro por cima
    d.rounded_rectangle([cx - 10, body_y - body_h // 2 - chest // 2,
                         cx + 11, body_y - 1], 4, fill=C["hi"])
    # barriga clara
    d.rounded_rectangle([cx - 9, body_y + 1, cx + 8, body_y + body_h // 2], 3, fill=C["belly"])
    if kind == "cat" and stage != 0:
        for sx in range(cx - 10, cx + 8, 5):   # listras
            d.line([sx, body_y - body_h // 2, sx + 2, body_y - 1], fill=C["sh"])
    if kind == "dog" and stage == 2:
        # músculos do ombro
        d.ellipse([cx + 2, body_y - body_h // 2 - chest // 2, cx + 13, body_y + 2], fill=C["hi"])
        d.arc([cx + 4, body_y - 6, cx + 12, body_y + 1], 200, 340, fill=C["sh"])

    # ---- patas da frente ----
    for side, col in ((-1, C["sh"]), (1, C["mid"])):
        phase = t + math.pi if side > 0 else t
        fx = cx + 9 + math.sin(phase) * (4 if stage else 3)
        brush(d, (cx + 9, body_y + body_h // 2), (fx, GROUND - 2), leg_w, col)
        d.ellipse([fx - 3, GROUND - 3, fx + 3, GROUND], fill=col)

    # ---- cabeca ----
    hx = cx + 15
    hy = body_y - body_h // 2 - head_r + 3 + (3 if (kind == "cat" and stage == 0) else 0)
    d.ellipse([hx - head_r, hy - head_r, hx + head_r, hy + head_r], fill=C["mid"])
    d.ellipse([hx - head_r + 2, hy - head_r + 1, hx + head_r - 1, hy + 2], fill=C["hi"])
    # focinho
    d.ellipse([hx + 2, hy + 1, hx + head_r + 3, hy + 7], fill=C["belly"])
    d.ellipse([hx + head_r, hy + 2, hx + head_r + 3, hy + 5], fill=OUTLINE)

    if kind == "dog":
        # orelha caida
        d.ellipse([hx - 8, hy - 5, hx - 1, hy + 6], fill=C["sh"])
        if stage == 2:
            d.ellipse([hx - 8, hy - 7, hx - 2, hy + 1], fill=C["mid"])  # orelha erguida
    else:
        # orelhas triangulares (caidas quando murcho)
        if stage == 0:
            d.polygon([(hx - 7, hy - 3), (hx - 1, hy - 5), (hx - 6, hy + 2)], fill=C["sh"])
            d.polygon([(hx + 1, hy - 5), (hx + 6, hy - 3), (hx + 3, hy + 1)], fill=C["mid"])
        else:
            d.polygon([(hx - 7, hy - 2), (hx - 5, hy - 10), (hx - 1, hy - 3)], fill=C["sh"])
            d.polygon([(hx + 1, hy - 3), (hx + 4, hy - 10), (hx + 7, hy - 2)], fill=C["mid"])
            d.polygon([(hx + 2, hy - 3), (hx + 4, hy - 8), (hx + 6, hy - 3)], fill=(240, 180, 190, 255))

    # olho + boca
    blink = (stage == 0 and i % 4 == 3)
    if blink or (kind == "cat" and stage == 0):
        d.line([hx + 2, hy, hx + 5, hy], fill=OUTLINE)
    else:
        d.rectangle([hx + 2, hy - 2, hx + 4, hy + 1], fill=(252, 252, 252, 255))
        d.rectangle([hx + 4, hy - 1, hx + 5, hy + 1], fill=OUTLINE)
    if stage == 2:
        # sorriso/lingua
        d.arc([hx + 1, hy + 3, hx + 7, hy + 8], 0, 180, fill=OUTLINE)
        if kind == "dog":
            d.ellipse([hx + 3, hy + 6, hx + 6, hy + 9 + (1 if i % 2 else 0)],
                      fill=(238, 122, 138, 255))
    elif stage == 0:
        d.arc([hx + 1, hy + 5, hx + 7, hy + 9], 180, 360, fill=OUTLINE)

    # ---- coleira ----
    d.rectangle([hx - 9, hy + 5, hx - 4, hy + 12], fill=C["collar"])
    d.rectangle([hx - 9, hy + 10, hx - 4, hy + 12], fill=C["collar_sh"])
    d.ellipse([hx - 8, hy + 11, hx - 5, hy + 14], fill=C["tag"])

    # gota escorrendo no gato murcho (na lateral do rosto, como suor de cansaço)
    if kind == "cat" and stage == 0 and i % 2 == 0:
        gy = hy + 1 + (1 if i % 4 else 0)
        d.ellipse([hx - 2, gy, hx, gy + 3], fill=(150, 200, 240, 255))

    return outline_fig(img)


def make_sheet(kind):
    sheet = Image.new("RGBA", (FW * FRAMES, FH * 3), (0, 0, 0, 0))
    for stage in range(3):
        for i in range(FRAMES):
            sheet.alpha_composite(draw_pet(kind, stage, i), (i * FW, stage * FH))
    sheet.save(os.path.join(OUT, f"{kind}.png"))
    return sheet


def make_portrait(sheet, kind):
    """Retrato do estágio normal, para a tela de Perfil."""
    frame = sheet.crop((0, FH, FW, FH * 2))
    frame = frame.crop(frame.getbbox())
    big = frame.resize((frame.width * 2, frame.height * 2), Image.NEAREST)
    big.save(os.path.join(OUT, f"mascot_{kind}.png"))


def make_preview(sheets):
    scale = 4
    w = FW * FRAMES * scale
    h = FH * 3 * len(sheets) * scale
    prev = Image.new("RGBA", (w, h), (150, 205, 245, 255))
    for i, s in enumerate(sheets):
        prev.alpha_composite(s.resize((s.width * scale, s.height * scale), Image.NEAREST),
                             (0, i * FH * 3 * scale))
    prev.save(os.path.join(OUT, "mascots_preview.png"))


if __name__ == "__main__":
    sheets = []
    for kind in ("dog", "cat"):
        s = make_sheet(kind)
        make_portrait(s, kind)
        sheets.append(s)
    make_preview(sheets)
    print("mascotes gerados em", os.path.abspath(OUT))
