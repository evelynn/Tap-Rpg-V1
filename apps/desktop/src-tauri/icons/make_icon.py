# 창·exe·트레이 아이콘: 가문 문장(assets/ready/ui_family_crest_16.png, v07 codex 그림, D89)을 잘라 정수배(가장 가까운 이웃)로만 키운다.
# 그림을 새로 그리지 않는다(D56·D66: 도구는 옮기기·자르기·고르기만). ICO는 PNG 항목을 그대로 담는다.
# 트레이: 칸 0 = 기본, 칸 1 = 새 소식 점(선택·계승 대기, 03 §10). 32 × 32 RGBA 날것으로 두어 Rust가 그대로 읽는다.
import io, struct
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[4]
here = Path(__file__).resolve().parent
sheet = Image.open(ROOT / 'assets/ready/ui_family_crest_16.png').convert('RGBA')
CELL = 24

def square(n: int) -> Image.Image:
    frame = sheet.crop((n * CELL, 0, n * CELL + CELL, CELL))
    l, t, r, b = frame.getbbox()
    side = max(r - l, b - t)
    sq = Image.new('RGBA', (side, side))
    sq.paste(frame.crop((l, t, r, b)), ((side - (r - l)) // 2, (side - (b - t)) // 2))
    return sq

def fit(sq: Image.Image, size: int) -> Image.Image:
    k = max(1, size // sq.width)
    big = sq.resize((sq.width * k, sq.height * k), Image.NEAREST)
    out = Image.new('RGBA', (size, size))
    out.paste(big, ((size - big.width) // 2, (size - big.height) // 2))
    return out

base, news = square(0), square(1)
entries = []
for size in (32, 48, 64, 128, 256):
    buf = io.BytesIO()
    img = fit(base, size)
    img.save(buf, 'PNG')
    entries.append((size, buf.getvalue()))
    if size == 128: img.save(here / 'icon.png')
head = struct.pack('<HHH', 0, 1, len(entries))
off = 6 + 16 * len(entries)
dirs, datas = b'', b''
for size, data in entries:
    dirs += struct.pack('<BBBBHHII', size % 256, size % 256, 0, 0, 1, 32, len(data), off + len(datas))
    datas += data
(here / 'icon.ico').write_bytes(head + dirs + datas)
(here / 'tray.rgba').write_bytes(fit(base, 32).tobytes())
(here / 'tray_news.rgba').write_bytes(fit(news, 32).tobytes())
print('crest', base.size, 'ok')
