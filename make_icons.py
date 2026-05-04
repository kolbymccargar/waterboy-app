from PIL import Image

src  = r"C:\Users\kolby\OneDrive\Desktop\waterboy-app\Drop.PNG"
base = r"C:\Users\kolby\OneDrive\Desktop\waterboy-app"

img  = Image.open(src).convert("RGBA")
pixels = img.load()
w, h = img.size

# Sample background color from all four corners (8x8 each)
def corner_avg(px, xs, ys):
    rs, gs, bs = 0, 0, 0
    n = 0
    for x in xs:
        for y in ys:
            r, g, b, a = px[x, y]
            rs += r; gs += g; bs += b; n += 1
    return rs/n, gs/n, bs/n

p = img.load()
xs_l = range(0, 8); xs_r = range(w-8, w)
ys_t = range(0, 8); ys_b = range(h-8, h)
corners = [
    corner_avg(p, xs_l, ys_t),
    corner_avg(p, xs_r, ys_t),
    corner_avg(p, xs_l, ys_b),
    corner_avg(p, xs_r, ys_b),
]
bg_r = sum(c[0] for c in corners) / 4
bg_g = sum(c[1] for c in corners) / 4
bg_b = sum(c[2] for c in corners) / 4
print(f"BG sample: R={bg_r:.0f} G={bg_g:.0f} B={bg_b:.0f}")

THRESHOLD = 28
FEATHER   = 12

result = Image.new("RGBA", (w, h))
rp = result.load()

for y in range(h):
    for x in range(w):
        r, g, b, a = p[x, y]
        dist = ((r - bg_r)**2 + (g - bg_g)**2 + (b - bg_b)**2) ** 0.5
        new_a = int(max(0, min(255, (dist - THRESHOLD) * FEATHER)))
        rp[x, y] = (r, g, b, new_a)

print(f"Transparency applied ({w}x{h})")

# icon-192.png
result.resize((192,192), Image.LANCZOS).save(f"{base}\\icon-192.png")
print("icon-192.png saved")

# icon-512.png
result.resize((512,512), Image.LANCZOS).save(f"{base}\\icon-512.png")
print("icon-512.png saved")

# apple-touch-icon.png
result.resize((180,180), Image.LANCZOS).save(f"{base}\\apple-touch-icon.png")
print("apple-touch-icon.png saved")

# og-image.png — 1200x630 dark bg
og   = Image.new("RGBA", (1200, 630), (8, 14, 32, 255))
drop = result.resize((420, 420), Image.LANCZOS)
og.paste(drop, (390, 105), drop)
og.convert("RGB").save(f"{base}\\og-image.png")
print("og-image.png saved")

# favicon.ico — 16, 32, 48
sizes    = [16, 32, 48]
ico_imgs = [result.resize((s, s), Image.LANCZOS).convert("RGBA") for s in sizes]
ico_imgs[0].save(
    f"{base}\\favicon.ico",
    format="ICO",
    sizes=[(s, s) for s in sizes],
    append_images=ico_imgs[1:]
)
print("favicon.ico saved")
print("Done.")
