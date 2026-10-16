#!/usr/bin/env python3
"""
Genera build/icon.ico (multi-resolución) y build/icon.png para SeriesTrack.
Solo usa la biblioteca estándar de Python (zlib + struct).

Diseño: cuadrado redondeado oscuro con un anillo de progreso (gris + arco
naranja) y un triángulo de reproducción en el centro.
"""

import math
import os
import struct
import zlib

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "build")
ASSETS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets")

ACCENT = (229, 160, 13)
ACCENT_DARK = (184, 122, 0)
RING_EMPTY = (58, 58, 58)
TRIANGLE = (245, 245, 245)
BG_TOP = (27, 27, 27)
BG_BOTTOM = (11, 11, 11)


def _rounded_rect_mask(x, y, w, radius):
    half = w / 2.0
    dx = max(abs(x - half) - (half - radius), 0.0)
    dy = max(abs(y - half) - (half - radius), 0.0)
    return dx * dx + dy * dy <= radius * radius


def _point_in_triangle(px, py, ax, ay, bx, by, cx, cy):
    d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by)
    d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy)
    d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay)
    has_neg = d1 < 0 or d2 < 0 or d3 < 0
    has_pos = d1 > 0 or d2 > 0 or d3 > 0
    return not (has_neg and has_pos)


def render(size, ss=4):
    """Devuelve filas RGBA (lista de bytearray) a la resolución pedida."""
    w = size * ss
    rows = [bytearray(w * 4) for _ in range(w)]

    cx = cy = w / 2.0
    radius = w * 0.225
    r_out = w * 0.365
    r_in = w * 0.275

    # Triángulo de reproducción
    ax, ay = cx - w * 0.105, cy - w * 0.150
    bx, by = cx - w * 0.105, cy + w * 0.150
    tx, ty = cx + w * 0.140, cy

    for y in range(w):
        row = rows[y]
        for x in range(w):
            if not _rounded_rect_mask(x + 0.5, y + 0.5, w, radius):
                continue

            # Fondo con degradado vertical
            t = y / max(w - 1, 1)
            r = int(BG_TOP[0] + (BG_BOTTOM[0] - BG_TOP[0]) * t)
            g = int(BG_TOP[1] + (BG_BOTTOM[1] - BG_TOP[1]) * t)
            b = int(BG_TOP[2] + (BG_BOTTOM[2] - BG_TOP[2]) * t)

            dx = x + 0.5 - cx
            dy = y + 0.5 - cy
            dist = math.hypot(dx, dy)

            if r_in <= dist <= r_out:
                # Ángulo con 0 en la parte superior, sentido horario
                ang = (math.degrees(math.atan2(dy, dx)) + 90.0) % 360.0
                if ang <= 280.0:
                    # Degradado del arco
                    k = (math.sin(math.radians(ang - 90)) + 1) / 2
                    r = int(ACCENT_DARK[0] + (ACCENT[0] - ACCENT_DARK[0]) * k)
                    g = int(ACCENT_DARK[1] + (ACCENT[1] - ACCENT_DARK[1]) * k)
                    b = int(ACCENT_DARK[2] + (ACCENT[2] - ACCENT_DARK[2]) * k)
                else:
                    r, g, b = RING_EMPTY
            elif _point_in_triangle(x + 0.5, y + 0.5, ax, ay, bx, by, tx, ty):
                r, g, b = TRIANGLE

            i = x * 4
            row[i] = r
            row[i + 1] = g
            row[i + 2] = b
            row[i + 3] = 255

    # Downsample (supersampling)
    out = []
    for y in range(size):
        out_row = bytearray(size * 4)
        for x in range(size):
            ar = ag = ab = aa = 0
            for sy in range(ss):
                src = rows[y * ss + sy]
                base = x * ss * 4
                for sx in range(ss):
                    i = base + sx * 4
                    ar += src[i]
                    ag += src[i + 1]
                    ab += src[i + 2]
                    aa += src[i + 3]
            n = ss * ss
            i = x * 4
            out_row[i] = ar // n
            out_row[i + 1] = ag // n
            out_row[i + 2] = ab // n
            out_row[i + 3] = aa // n
        out.append(out_row)
    return out


def to_png(size, rows):
    raw = bytearray()
    for row in rows:
        raw.append(0)  # filtro None
        raw.extend(row)

    def chunk(tag, data):
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + chunk(b"IEND", b"")
    )


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    sizes = [16, 24, 32, 48, 64, 128, 256]

    images = []
    for size in sizes:
        print(f"  renderizando {size}x{size}…")
        rows = render(size, ss=4 if size <= 64 else 2)
        images.append((size, to_png(size, rows)))

    # Guardar PNG de referencia (256 px)
    with open(os.path.join(OUT_DIR, "icon.png"), "wb") as fh:
        fh.write(images[-1][1])

    # Ensamblar ICO
    count = len(images)
    header = struct.pack("<HHH", 0, 1, count)
    offset = 6 + 16 * count
    entries = b""
    payload = b""
    for size, data in images:
        dim = 0 if size >= 256 else size
        entries += struct.pack(
            "<BBBBHHII", dim, dim, 0, 0, 1, 32, len(data), offset
        )
        payload += data
        offset += len(data)

    ico_path = os.path.join(OUT_DIR, "icon.ico")
    with open(ico_path, "wb") as fh:
        fh.write(header + entries + payload)

    # Copia dentro de la app (para el icono de la ventana y la bandeja)
    os.makedirs(ASSETS_DIR, exist_ok=True)
    with open(os.path.join(ASSETS_DIR, "icon.ico"), "wb") as fh:
        fh.write(header + entries + payload)

    print(f"OK -> {ico_path} ({os.path.getsize(ico_path)} bytes)")


if __name__ == "__main__":
    main()
