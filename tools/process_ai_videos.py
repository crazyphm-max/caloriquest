#!/usr/bin/env python3
"""Transforma os videos de animacao gerados por IA nos sprite sheets do jogo.

Entrada: 8 MP4 (4 animacoes x 2 personagens), personagem animado "no lugar"
sobre fundo cinza chapado.

Para cada video:
  1. extrai os frames com ffmpeg
  2. remove o fundo cinza e as sombras projetadas
  3. mede o periodo do ciclo de animacao por autocorrelacao da silhueta
  4. escolhe FRAMES poses igualmente espacadas dentro de UM ciclo (loop perfeito)
  5. alinha pelos pes e pelo centro do corpo, normaliza a escala
  6. monta walker_m.png / walker_f.png (FRAMES col x 4 linhas)

Uso: python3 tools/process_ai_videos.py <pasta_com_os_mp4>
"""
import os
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image
from scipy import ndimage

import imageio_ffmpeg

OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "sprites")
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()

# arquivo -> (personagem, animacao)
SOURCES = {
    "56398644-515115238_1785765837659559.mp4": ("m", "walk"),
    "6a51a356-418498672_1785765846932861.mp4": ("m", "run"),
    "0a2cedd2-846198344_1785765859918218.mp4": ("m", "sad"),
    "7aee82f0-737480670_1785765853804999.mp4": ("m", "idle"),
    "ee5a4fd3-369142291_1785765878753766.mp4": ("f", "walk"),
    "cbff896a-549976586_1785765886354694.mp4": ("f", "run"),
    "94cd4111-990438071_1785765902712825.mp4": ("f", "sad"),
    "981be4a7-412262664_1785765894879156.mp4": ("f", "idle"),
}

ROW_ORDER = ["walk", "run", "sad", "idle"]
FW, FH = 80, 96      # frame final do sheet
FRAMES = 6           # poses por animacao
CHAR_H = 84          # altura do personagem dentro do frame
BASELINE = 93        # linha dos pes dentro do frame
WORK_H = 540         # altura de trabalho na extracao


def extract_frames(path, tmpdir):
    """Extrai os frames do video em WORK_H de altura."""
    subprocess.run(
        [FFMPEG, "-loglevel", "error", "-i", path,
         "-vf", f"scale=-2:{WORK_H}", os.path.join(tmpdir, "f%04d.png")],
        check=True,
    )
    files = sorted(os.listdir(tmpdir))
    return [np.asarray(Image.open(os.path.join(tmpdir, f)).convert("RGB")).astype(np.int16)
            for f in files]


def foreground_mask(rgb):
    """Personagem = tudo que difere do cinza de fundo.

    O fundo e cinza quase neutro e claro; sombras projetadas tambem sao cinza,
    so que mais escuras. Entao: mantem o que tem cor (saturacao) OU o que e
    bem escuro (contornos pretos do desenho)."""
    mx = rgb.max(axis=2)
    mn = rgb.min(axis=2)
    sat = mx - mn                      # quanto o pixel tem de cor
    dark = mx < 90                     # contorno preto do desenho
    mask = (sat > 26) | dark
    # limpa: fecha buracos, tira respingos, mantem o maior corpo
    mask = ndimage.binary_closing(mask, np.ones((5, 5)))
    mask = ndimage.binary_opening(mask, np.ones((3, 3)))
    lab, n = ndimage.label(mask)
    if n == 0:
        return mask
    sizes = ndimage.sum(mask, lab, range(1, n + 1))
    mask = lab == (np.argmax(sizes) + 1)
    return ndimage.binary_fill_holes(mask)


def cutout(rgb, mask):
    """RGBA recortado na bbox da mascara."""
    ys, xs = np.where(mask)
    if len(ys) == 0:
        return None, None
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    sub = rgb[y0:y1, x0:x1]
    a = (mask[y0:y1, x0:x1] * 255).astype(np.uint8)
    rgba = np.dstack([sub.astype(np.uint8), a])
    return Image.fromarray(rgba, "RGBA"), (y0, y1, x0, x1)


SIL = (32, 24)   # silhueta normalizada usada para comparar poses


def silhouette(mask):
    """Silhueta recortada e reamostrada para um tamanho fixo: permite comparar
    poses de frames diferentes mesmo que o personagem oscile na tela."""
    ys, xs = np.where(mask)
    if len(ys) == 0:
        return np.zeros(SIL, dtype=np.float32)
    sub = mask[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    img = Image.fromarray((sub * 255).astype(np.uint8)).resize(
        (SIL[1], SIL[0]), Image.BILINEAR)
    return np.asarray(img, dtype=np.float32) / 255.0


def pose_distance(sils):
    """Matriz de distancia entre poses (media do erro absoluto)."""
    a = np.stack(sils).reshape(len(sils), -1)
    return np.abs(a[:, None, :] - a[None, :, :]).mean(axis=2)


def cycle_period(sils, lo=8, hi=110):
    """Periodo do ciclo: o deslocamento P em que cada frame mais se parece com
    o frame P quadros depois (minimo da distancia media)."""
    n = len(sils)
    a = np.stack(sils).reshape(n, -1)
    best, best_d = None, 1e9
    hi = min(hi, n - 10)
    for p in range(lo, hi):
        d = float(np.abs(a[:-p] - a[p:]).mean())
        if d < best_d:
            best, best_d = p, d
    return best, best_d


def process_video(path):
    with tempfile.TemporaryDirectory() as tmp:
        frames = extract_frames(path, tmp)
    masks = [foreground_mask(f) for f in frames]
    sils = [silhouette(m) for m in masks]
    period, score = cycle_period(sils)

    # 6 poses igualmente espacadas dentro de um ciclo, comecando depois do
    # inicio (os primeiros frames costumam ter o personagem "acordando")
    start = max(4, len(frames) // 8)
    if period is None:
        period = len(frames) - start - 1

    # se o ciclo for curto demais para 6 poses distintas (ex.: idle parado),
    # espalha as poses por varios ciclos para pegar respiracao e piscada
    span = period if period >= FRAMES * 2 else period * max(1, round(24 / period))
    idxs = [(start + round(i * span / FRAMES)) % len(frames) for i in range(FRAMES)]

    picked = []
    for i in idxs:
        img, box = cutout(frames[i], masks[i])
        if img is None:
            continue
        # centraliza pelo TORSO (terco superior): braços e pernas balançam,
        # o tronco não — assim a animação não treme na tela
        m = masks[i]
        y0, y1 = box[0], box[1]
        top = m[y0:y0 + max(1, (y1 - y0) // 3)]
        ys2, xs2 = np.where(top)
        anchor = np.median(xs2) if len(xs2) else np.median(np.where(m)[1])
        cxr = (anchor - box[2]) / img.width
        picked.append((img, cxr))
    return picked, period, score


def compose(variant, anims):
    sheet = Image.new("RGBA", (FW * FRAMES, FH * len(ROW_ORDER)), (0, 0, 0, 0))
    for row, anim in enumerate(ROW_ORDER):
        picked = anims[anim]
        max_h = max(im.height for im, _ in picked)
        scale = CHAR_H / max_h
        for col, (im, cxr) in enumerate(picked):
            nw, nh = max(1, round(im.width * scale)), max(1, round(im.height * scale))
            small = im.resize((nw, nh), Image.LANCZOS)
            # alpha duro: sem franja semitransparente
            r, g, b, a = small.split()
            a = a.point(lambda p: 255 if p > 120 else 0)
            small = Image.merge("RGBA", (r, g, b, a))
            # centraliza pelo centro do corpo, apoia os pes na baseline
            x = col * FW + round(FW / 2 - cxr * nw)
            y = row * FH + BASELINE - nh
            sheet.alpha_composite(small, (max(col * FW, x), max(row * FH, y)))
    sheet.save(os.path.join(OUT, f"walker_{variant}.png"))
    return sheet


def make_char_preview(sheet, variant):
    frame = sheet.crop((0, FH * 3, FW, FH * 4))  # idle frame 0
    frame = frame.crop(frame.getbbox())
    frame.resize((frame.width * 2, frame.height * 2), Image.NEAREST) \
         .save(os.path.join(OUT, f"char_{variant}.png"))


def make_icons(sheet):
    frame = sheet.crop((0, 0, FW, FH))
    frame = frame.crop(frame.getbbox())
    for size in (192, 512):
        img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        grad = np.zeros((size, size, 3), dtype=np.uint8)
        for y in range(size):
            t = y / size
            if t < 0.72:
                grad[y] = (127, 196, 242)
            else:
                k = (t - 0.72) / 0.28
                grad[y] = (127 + (104 - 127) * k, 196 + (168 - 196) * k, 242 + (84 - 242) * k)
        img.alpha_composite(Image.fromarray(grad).convert("RGBA"))
        s = size * 0.84 / frame.height
        cw, ch = int(frame.width * s), int(frame.height * s)
        img.alpha_composite(frame.resize((cw, ch), Image.LANCZOS),
                            ((size - cw) // 2, int(size * 0.96) - ch))
        img.save(os.path.join(OUT, f"icon-{size}.png"))


def make_preview(sheets):
    scale = 2
    w, h = FW * FRAMES * scale, FH * len(ROW_ORDER) * len(sheets) * scale
    prev = Image.new("RGBA", (w, h), (150, 205, 245, 255))
    for i, s in enumerate(sheets):
        prev.alpha_composite(s.resize((s.width * scale, s.height * scale), Image.NEAREST),
                             (0, i * FH * len(ROW_ORDER) * scale))
    prev.save(os.path.join(OUT, "preview.png"))


def main(src_dir):
    collected = {"m": {}, "f": {}}
    for fname, (variant, anim) in SOURCES.items():
        picked, period, score = process_video(os.path.join(src_dir, fname))
        print(f"{variant}/{anim}: ciclo de {period} frames (erro {score:.4f}) "
              f"-> {len(picked)} poses")
        collected[variant][anim] = picked

    sheets = []
    for variant in ("m", "f"):
        sheet = compose(variant, collected[variant])
        make_char_preview(sheet, variant)
        sheets.append(sheet)
    make_icons(sheets[0])
    make_preview(sheets)
    print("ok:", os.path.abspath(OUT))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ".")
