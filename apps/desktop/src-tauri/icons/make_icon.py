# 창·exe 아이콘: 주인공 기준 시트(assets/ready/chr_actions18_48.png) 대기 1프레임을 잘라 정수배(가장 가까운 이웃)로만 키운다.
# 그림을 새로 그리지 않는다(D56·D66: 도구는 옮기기·자르기·고르기만). ICO는 PNG 항목을 그대로 담는다.
import io, struct
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[4]
here = Path(__file__).resolve().parent
sheet = Image.open(ROOT / 'assets/ready/chr_actions18_48.png').convert('RGBA')
frame = sheet.crop((0, 0, 48, 48))
l, t, r, b = frame.getbbox()
side = max(r - l, b - t)
sq = Image.new('RGBA', (side, side))
sq.paste(frame.crop((l, t, r, b)), ((side - (r - l)) // 2, side - (b - t)))

def fit(size: int) -> Image.Image:
    k = max(1, size // side)
    big = sq.resize((side * k, side * k), Image.NEAREST)
    out = Image.new('RGBA', (size, size))
    out.paste(big, ((size - big.width) // 2, (size - big.height) // 2))
    return out

entries = []
for size in (48, 64, 128, 256):  # 32는 40 픽셀 그림이 잘리므로 두지 않는다(작게는 운영체제가 줄인다)
    buf = io.BytesIO()
    img = fit(size)
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
print('bbox', side, 'ok')
