#!/usr/bin/env python3
"""
Derive every web image in public/assets/img/ from the masters in artwork/.

    python3 -m pip install Pillow fonttools brotli
    python3 tools/build-assets.py

Pillow is required. fonttools + brotli are only needed for the social card,
which is skipped with a warning if they are missing.
"""

import os
import random
import sys

try:
    from PIL import Image, ImageDraw, ImageFilter, ImageFont
except ImportError:  # pragma: no cover
    sys.exit('Pillow is required: python3 -m pip install Pillow')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'artwork')
OUT = os.path.join(ROOT, 'public', 'assets', 'img')
FONTS = os.path.join(ROOT, 'public', 'assets', 'fonts')

# Sampled from artwork/deneuve_logo.png — the single source of truth for the
# palette, shared with the --marigold/--brick/etc. tokens in styles.css.
CREAM = (240, 227, 194)
INK = (36, 36, 24)
BRICK = (187, 52, 16)
MARIGOLD = (240, 144, 0)


def unmatte(im, passes=6):
    """Bleed opaque colour outward so cut-out edges lose their dark halo."""
    im = im.convert('RGBA')
    rgb, alpha = im.convert('RGB'), im.getchannel('A')
    mask = alpha.point(lambda a: 255 if a > 200 else 0)
    for _ in range(passes):
        rgb = Image.composite(rgb, rgb.filter(ImageFilter.GaussianBlur(2)), mask)
        mask = mask.filter(ImageFilter.MaxFilter(5))
    out = rgb.convert('RGBA')
    out.putalpha(alpha)
    return out


def trim(im, pad=8):
    box = im.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox()
    if not box:
        return im
    l, t, r, b = box
    return im.crop((max(0, l - pad), max(0, t - pad),
                    min(im.width, r + pad), min(im.height, b + pad)))


def emit(im, name, width):
    """Write the smaller of a quantised PNG and a WebP, and drop the loser.

    Which format wins is not obvious for this artwork: flat screenprint colour
    palettes down to a very small PNG, while the shaded illustration favours
    WebP. Rather than guess, encode both, keep the winner, and never ship a
    variant nothing references.
    """
    if im.width != width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)

    png, webp = os.path.join(OUT, f'{name}.png'), os.path.join(OUT, f'{name}.webp')
    # Flat screenprint colour survives an octree palette intact and shrinks hard.
    im.quantize(colors=200, method=Image.FASTOCTREE).save(png, optimize=True)
    im.save(webp, quality=82, method=6)

    p, w = os.path.getsize(png) / 1024, os.path.getsize(webp) / 1024
    best, loser = (png, webp) if p <= w else (webp, png)
    os.remove(loser)

    print(f'  {name:18s} {im.width:4d}x{im.height:<4d} '
          f'png {p:7.1f}kB  webp {w:7.1f}kB  → kept {os.path.basename(best)}')
    return im


def check_references():
    """Fail loudly if the site points at an image this run did not produce."""
    import re
    referenced = set()
    for base, _, files in os.walk(os.path.join(ROOT, 'public')):
        if os.path.basename(base) == 'img':
            continue
        for f in files:
            if not f.endswith(('.html', '.css', '.js', '.webmanifest')):
                continue
            text = open(os.path.join(base, f), encoding='utf-8').read()
            referenced.update(re.findall(r'assets/img/([\w.-]+)', text))

    missing = sorted(n for n in referenced if not os.path.exists(os.path.join(OUT, n)))
    orphans = sorted(set(os.listdir(OUT)) - referenced - {'og-card.jpg'})

    if missing:
        print('\n  MISSING — the site references these but they were not built:')
        for n in missing:
            print(f'    {n}')
    if orphans:
        print('\n  Built but unreferenced (safe to delete):')
        for n in orphans:
            print(f'    {n}')
    if not missing and not orphans:
        print('\n  Every built image is referenced, and every reference exists.')
    return not missing


def build_images():
    os.makedirs(OUT, exist_ok=True)

    print('monogram:')
    mark = trim(unmatte(Image.open(os.path.join(SRC, 'deneuve_logocut.png'))))
    emit(mark, 'mark', 512)
    emit(mark, 'mark-small', 192)

    print('seamstress:')
    girl = trim(unmatte(Image.open(os.path.join(SRC, 'deneuve_girlcut.PNG'))))
    emit(girl, 'girl', 900)
    emit(girl, 'girl-small', 460)

    print('icons:')
    for size, name in ((180, 'apple-touch-icon'), (512, 'icon-512'), (192, 'icon-192')):
        canvas = Image.new('RGBA', (size, size), CREAM + (255,))
        m = mark.copy()
        m.thumbnail((size - round(size * .16), size - round(size * .16)), Image.LANCZOS)
        canvas.paste(m, ((size - m.width) // 2, (size - m.height) // 2), m)
        canvas.convert('RGB').save(os.path.join(OUT, f'{name}.png'), optimize=True)
        print(f'  {name}.png')

    ico = Image.new('RGBA', (256, 256), CREAM + (255,))
    m = mark.copy()
    m.thumbnail((236, 236), Image.LANCZOS)
    ico.paste(m, ((256 - m.width) // 2, (256 - m.height) // 2), m)
    ico.save(os.path.join(ROOT, 'public', 'favicon.ico'), sizes=[(16, 16), (32, 32), (48, 48)])
    print('  favicon.ico')

    return mark


def ttf(name):
    """Decompress a self-hosted woff2 into a TTF Pillow can rasterise."""
    from fontTools.ttLib.woff2 import decompress
    dst = os.path.join(OUT, f'.{name}.ttf')
    with open(os.path.join(FONTS, f'{name}.woff2'), 'rb') as f, open(dst, 'wb') as g:
        decompress(f, g)
    return dst


def build_og_card():
    """1200x630 share card, typeset in the same fonts the site uses."""
    try:
        title_path, text_path = ttf('fraunces-latin'), ttf('jost-latin')
    except Exception as err:
        print(f'  skipped og-card.jpg ({err}) — pip install fonttools brotli')
        return

    W, H = 1200, 630
    card = Image.new('RGB', (W, H), CREAM)

    # Paper grain: sparse light speckle, matching the .grain overlay in CSS.
    random.seed(7)
    noise = Image.frombytes('L', (W, H), bytes(random.getrandbits(8) for _ in range(W * H)))
    card = Image.composite(Image.new('RGB', (W, H), (214, 199, 165)), card,
                           noise.point(lambda v: 255 if v > 205 else 0))

    d = ImageDraw.Draw(card)
    d.rectangle([0, 0, W, 14], fill=BRICK)
    d.rectangle([0, H - 14, W, H], fill=MARIGOLD)

    mark = Image.open(os.path.join(OUT, 'mark.png')).convert('RGBA')
    mark.thumbnail((400, 400), Image.LANCZOS)
    card.paste(mark, (72, (H - mark.height) // 2), mark)

    x = 72 + mark.width + 64
    avail = W - x - 72

    def fitted(path, px, axes, text):
        """Largest size at or below px whose rendered width still fits."""
        while px > 8:
            f = ImageFont.truetype(path, px)
            f.set_variation_by_axes(axes)
            if d.textlength(text, font=f) <= avail:
                return f
            px -= 2
        return f

    title = fitted(title_path, 132, [144, 900, 100, 1], 'DENEUVE')       # opsz wght SOFT WONK
    sub = fitted(text_path, 38, [500], 'STYLE · ALTER · REPAIR')
    tag = fitted(text_path, 34, [400], 'A tailoring atelier since 1974')

    top = 196
    d.text((x + 7, top + 7), 'DENEUVE', font=title, fill=BRICK)   # misregistered plate
    d.text((x, top), 'DENEUVE', font=title, fill=INK)

    y = top + title.size + 44
    d.text((x + 3, y), 'STYLE · ALTER · REPAIR', font=sub, fill=INK)
    y += sub.size + 26
    d.line([x + 3, y, x + 3 + min(avail, 430), y], fill=BRICK, width=5)
    d.text((x + 3, y + 24), 'A tailoring atelier since 1974', font=tag, fill=(90, 78, 62))

    card.save(os.path.join(OUT, 'og-card.jpg'), quality=86, optimize=True, progressive=True)
    print('  og-card.jpg')

    for name in ('fraunces-latin', 'jost-latin'):
        os.remove(os.path.join(OUT, f'.{name}.ttf'))


if __name__ == '__main__':
    build_images()
    print('social card:')
    build_og_card()
    print('references:')
    ok = check_references()
    print('\nDone.' if ok else '\nDone, with missing references above.')
    sys.exit(0 if ok else 1)
