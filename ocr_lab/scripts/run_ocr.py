"""Chạy OCR toàn bộ hóa đơn trong invoices/ -> output/<tên>.txt (RapidOCR tìm vùng, VietOCR đọc).

Chạy: venv\\Scripts\\python -I scripts\\run_ocr.py
"""
import os, sys, time, glob, json
LAB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.environ['TORCH_HOME'] = os.path.join(LAB, 'cache', 'torch')  # giữ trọng số trong môi trường cô lập
sys.stdout.reconfigure(encoding='utf-8')
import numpy as np
from PIL import Image
from rapidocr import RapidOCR
from vietocr.tool.predictor import Predictor
from vietocr.tool.config import Cfg

cfg = Cfg.load_config_from_name('vgg_transformer')
cfg['device'] = 'cpu'
cfg['weights'] = os.path.join(LAB, 'cache', 'vgg_transformer.pth')
cfg['predictor']['beamsearch'] = False
t0 = time.time()
rec = Predictor(cfg)
det = RapidOCR()
print('load models s:', round(time.time() - t0, 1))

stats = {}
for path in sorted(glob.glob(os.path.join(LAB, 'invoices', '*'))):
    name = os.path.splitext(os.path.basename(path))[0]
    img = Image.open(path).convert('RGB')
    W, H = img.size
    t = time.time()
    res = det(np.array(img)[:, :, ::-1], use_det=True, use_cls=False, use_rec=False)
    boxes = [] if res.boxes is None else res.boxes
    items = []
    for b in boxes:
        x0, x1, y0, y1 = int(b[:, 0].min()), int(b[:, 0].max()), int(b[:, 1].min()), int(b[:, 1].max())
        crop = img.crop((max(0, x0 - 3), max(0, y0 - 3), min(W, x1 + 3), min(H, y1 + 3)))
        if crop.size[0] < 4 or crop.size[1] < 4:
            continue
        items.append(((y0 + y1) / 2, x0, y1 - y0, rec.predict(crop)))
    items.sort()
    rows, cur = [], []
    for it in items:
        if cur and abs(it[0] - np.mean([c[0] for c in cur])) > max(8, 0.6 * it[2]):
            rows.append(cur); cur = []
        cur.append(it)
    if cur:
        rows.append(cur)
    with open(os.path.join(LAB, 'output', name + '.txt'), 'w', encoding='utf-8') as f:
        for r in rows:
            f.write(' | '.join(c[3] for c in sorted(r, key=lambda c: c[1])) + '\n')
    stats[name] = dict(size=[W, H], boxes=len(items), seconds=round(time.time() - t, 1))
    print(name, stats[name])
json.dump(stats, open(os.path.join(LAB, 'output', '_run_stats.json'), 'w'), indent=1)
