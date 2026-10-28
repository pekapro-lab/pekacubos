# App icon drawn by code: isometric grass block on a sky gradient (no external assets).
import random, sys, os
from PIL import Image, ImageDraw
random.seed(5)
def tile(base, amt, fringe=None):
    t = Image.new('RGB', (16, 16)); px = t.load()
    for y in range(16):
        for x in range(16):
            k = 1 + (random.random() - .5) * amt; px[x, y] = tuple(min(255, int(c * k)) for c in base)
    if fringe:
        for x in range(16):
            for y in range(random.randint(3, 5)):
                k = .85 + random.random() * .3; px[x, y] = tuple(int(c * k) for c in fringe)
    return t
def face(img, tex, quad, shade):
    # affine-map the 16x16 texture onto a parallelogram (o, u, v) by filling pixel cells
    o, u, v = quad; d = ImageDraw.Draw(img)
    for j in range(16):
        for i in range(16):
            c = tuple(int(ch * shade) for ch in tex.getpixel((i, j)))
            p = lambda a, b: (o[0] + u[0] * a + v[0] * b, o[1] + u[1] * a + v[1] * b)
            d.polygon([p(i / 16, j / 16), p((i + 1) / 16, j / 16), p((i + 1) / 16, (j + 1) / 16), p(i / 16, (j + 1) / 16)], fill=c)
def make(S, bg=True, scale=1.0):
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    if bg:
        d = ImageDraw.Draw(img)
        for y in range(S):
            t = y / S; d.line([(0, y), (S, y)], fill=(int(70 + 80 * t), int(150 + 60 * t), int(230 - 10 * t), 255))
    top, side = tile((95, 168, 58), .35), tile((134, 96, 62), .35, (95, 168, 58))
    c = S / 2; r = S * 0.34 * scale; h = r
    cy = S / 2 - h * 0.45
    T = (c, cy - r * .5); L = (c - r * .866, cy); R = (c + r * .866, cy); B = (c, cy + r * .5)
    face(img, top, (L, (B[0] - L[0], B[1] - L[1]), (T[0] - L[0], T[1] - L[1])), 1.0)  # top
    face(img, side, (L, (B[0] - L[0], B[1] - L[1]), (0, h)), 0.82)                    # left
    face(img, side, (B, (R[0] - B[0], R[1] - B[1]), (0, h)), 0.62)                    # right
    return img
os.makedirs('public', exist_ok=True)
make(1024).save('public/icon.png')
res = 'android/app/src/main/res'
if os.path.isdir(res):
    for name, s in {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}.items():
        big = make(s * 4).resize((s, s), Image.LANCZOS)
        big.save(f'{res}/mipmap-{name}/ic_launcher.png')
        m = Image.new('L', (s, s), 0); ImageDraw.Draw(m).ellipse([0, 0, s - 1, s - 1], fill=255)
        rnd = big.copy(); rnd.putalpha(m); rnd.save(f'{res}/mipmap-{name}/ic_launcher_round.png')
        fs = int(s * 108 / 48); make(fs * 4, bg=False, scale=0.62).resize((fs, fs), Image.LANCZOS).save(f'{res}/mipmap-{name}/ic_launcher_foreground.png')
    bgx = f'{res}/values/ic_launcher_background.xml'
    open(bgx, 'w').write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#6FA8E6</color>\n</resources>\n')
print('ok')
