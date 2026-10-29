# Draws Lumi's icon (violet glass orb with two eyes) as PNGs and a PNG-embedded ICO. Stdlib only.
import struct, sys, zlib, math
out = sys.argv[1]

def render(n):
    ss = 4  # supersampling for smooth edges
    rows = []
    for y in range(n):
        row = bytearray()
        for x in range(n):
            acc = [0.0, 0.0, 0.0, 0.0]
            for sy in range(ss):
                for sx in range(ss):
                    u = (x + (sx + 0.5) / ss) / n * 2 - 1
                    v = (y + (sy + 0.5) / ss) / n * 2 - 1
                    r = math.hypot(u, v)
                    if r > 0.94:
                        continue
                    t = (u + v + 2) / 4  # diagonal gradient #9a8cff -> #6a4cf0
                    c = [154 + (106 - 154) * t, 140 + (76 - 140) * t, 255 + (240 - 255) * t]
                    # sheen on the top-left, darker rim
                    sheen = max(0.0, 1 - math.hypot(u + 0.35, v + 0.45) / 0.55) ** 2 * 0.55
                    rim = max(0.0, (r - 0.8) / 0.14) * 0.25
                    c = [ch + (255 - ch) * sheen - ch * rim for ch in c]
                    for ex in (-0.3, 0.3):
                        if ((u - ex) / 0.11) ** 2 + ((v + 0.02) / 0.17) ** 2 <= 1:
                            c = [255, 255, 255]
                    for i in range(3):
                        acc[i] += c[i]
                    acc[3] += 255
            k = ss * ss
            a = acc[3] / k
            row += bytes([int(acc[i] / max(1, acc[3] / 255)) if a else 0 for i in range(3)] + [int(a)])
        rows.append(bytes(row))
    raw = b''.join(b'\x00' + r for r in rows)
    chunk = lambda t, d: struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', n, n, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')

sizes = [16, 32, 48, 256]
pngs = [render(n) for n in sizes]
open(f'{out}/icon.png', 'wb').write(pngs[-1])
head = struct.pack('<HHH', 0, 1, len(sizes))
offset = 6 + 16 * len(sizes)
dirs = b''
for n, p in zip(sizes, pngs):
    dirs += struct.pack('<BBBBHHII', n % 256, n % 256, 0, 0, 1, 32, len(p), offset)
    offset += len(p)
open(f'{out}/icon.ico', 'wb').write(head + dirs + b''.join(pngs))
print('ok')
