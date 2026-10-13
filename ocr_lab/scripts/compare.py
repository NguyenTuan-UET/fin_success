"""Trích trường từ output/<tên>.txt bằng quy tắc, ghi output/<tên>.xml, so với expected_output/*.expected.xml.

Chạy: python -I scripts\\compare.py   -> output/_compare.json và bảng tóm tắt.
Mỗi trường: PASS (khớp sau chuẩn hóa), CLOSE (giống >= 85%), FAIL (sai/không tìm thấy),
FP (đáp án trống nhưng trích ra giá trị). Thêm cột in_ocr: đáp án có xuất hiện trong văn bản OCR không
(tách lỗi OCR khỏi lỗi trích trường).
"""
import os, re, sys, glob, json, unicodedata, difflib
import xml.etree.ElementTree as ET
from xml.sax.saxutils import escape
sys.stdout.reconfigure(encoding='utf-8')
LAB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIELDS = ['KyHieu', 'So', 'NgayLap', 'NBan_Ten', 'NBan_MST', 'NMua_Ten', 'NMua_MST', 'TgTCThue', 'TgTThue', 'TgTTTBSo', 'TgTTTBChu']
NUMERIC = {'So', 'NBan_MST', 'NMua_MST', 'TgTCThue', 'TgTThue', 'TgTTTBSo'}


def strip(s):
    s = s.replace('đ', 'd').replace('Đ', 'D')
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')


def norm(s):
    return re.sub(r'[^A-Z0-9]', '', strip(s).upper())


def digits(s):
    return re.sub(r'\D', '', s)


NUM = r'(\d{1,3}(?:[.,]\d{3})+|\d+)'


def good(v):
    # giá trị rỗng/chấm chấm, hoặc thực ra là nhãn kế tiếp, thì không dùng
    v = v.strip()
    return len(re.sub(r'[.…\s_]', '', v)) > 3 and not re.search(r'\((?:Company|Address|Buyer|Tax|Seller)|[:;]$|^(?:Dia chi|Ten |Nguoi |Ho ten)', v, re.I)


def extract(text):
    a = strip(text)
    out = {f: '' for f in FIELDS}
    m = re.search(r'(?:k[yi] hi[eu]u|serial)[^A-Za-z0-9]{0,15}([0-9][A-Z][0-9]{2}[A-Z]{1,3}|[A-Z]{2}/\d{2}[A-Z])', a, re.I)
    if m: out['KyHieu'] = m.group(1).upper()
    # bắt buộc có dấu ':' hoặc '(No)' để không nhầm với "Số 125 đường ..." trong địa chỉ
    m = re.search(r'\bSo\b\s*(?:\(No\.?\)\s*[:.]?|[:.])\s*\|?\s*(\d{1,8})\b', a)
    if m: out['So'] = m.group(1)
    m = re.search(r'Ngay\s*(?:\([a-z]*\))?\s*(\d{1,2})\s*thang\s*(?:\([a-z]*\))?\s*(\d{1,2})\s*nam\s*(?:\([a-z]*\))?\s*(\d{4})', a, re.I)
    if m: out['NgayLap'] = '%s-%02d-%02d' % (m.group(3), int(m.group(2)), int(m.group(1)))
    msts = [digits(x) for x in re.findall(r'Ma so thue[^0-9|\n]{0,25}((?:\d[\s\-]{0,3}){10,14})', a, re.I)]
    if msts: out['NBan_MST'] = msts[0]
    if len(msts) > 1: out['NMua_MST'] = msts[1]
    m = re.search(r'(?:Ten nguoi ban|Don vi ban hang)[^:|\n]{0,20}:\s*([^|\n]+)', a, re.I)
    if m: out['NBan_Ten'] = m.group(1).strip()
    else:
        for line in a.split('\n'):
            m = re.search(r'((?:CONG TY|Chi nhanh|TAP DOAN|Trung tam)[^|\n]+)', line, re.I)
            if m: out['NBan_Ten'] = m.group(1).strip(); break
    for pat in ('Ten don vi mua hang|Ten don vi', 'Ten nguoi mua'):  # ưu tiên tên đơn vị, sau đó tên người mua
        m = re.search(r'(?:%s)[^:|\n]{0,25}:\s*\|?\s*([^|\n]+)' % pat, a, re.I)
        if m and good(m.group(1)):
            out['NMua_Ten'] = m.group(1).strip(); break
    # tổng tiền: hàng chứa nhãn, lấy các số cuối hàng
    for line in a.split('\n'):
        if re.search(r'Tong cong tien thanh toan|Tong tien thanh toan|Tong cong hoa don|Total payment|Total amount', line, re.I):
            tail = line.split(')', 1)[-1] if ')' in line else line
            # chữ 'o' đứng riêng là số 0 bị OCR đọc nhầm
            nums = [('0' if x.group(0).lower() == 'o' else digits(x.group(0))) for x in re.finditer(NUM + r'|(?<![A-Za-z])[oO](?![A-Za-z])', tail)]
            nums = [n for n in nums if n]
            if len(nums) >= 3:
                out['TgTTTBSo'], out['TgTThue'], out['TgTCThue'] = nums[-1], nums[-2], nums[-3]
            elif len(nums) >= 1:
                out['TgTTTBSo'] = nums[-1]
    for key, pat in (('TgTCThue', r'Cong tien hang'), ('TgTThue', r'Tien thue GTGT')):
        if not out[key]:
            for line in a.split('\n'):
                if re.search(pat, line, re.I):
                    nums = [digits(x) for x in re.findall(NUM, line)]
                    if nums: out[key] = nums[-1]; break
    m = re.search(r'bang chu[^:|\n]*:\s*\|?\s*([^|\n]+)', a, re.I)
    if m and good(m.group(1)):
        out['TgTTTBChu'] = m.group(1).strip()
    return out


def flags(text):
    a = strip(text).upper()
    f = []
    if re.search(r'HOA DON NHAP|\bNHAP\b', a): f.append('NHAP')
    if re.search(r'HOA DON MAU|(?:^|\|)\s*MAU\s*(?:\||$)', a, re.M): f.append('MAU')
    if re.search(r'DIEU CHINH CHO HOA DON|THAY THE CHO HOA DON', a): f.append('DIEUCHINH')
    return f


def judge(field, exp, got):
    if exp == '':
        return 'PASS' if got == '' else 'FP'
    if got == '':
        return 'FAIL'
    if field in NUMERIC:
        return 'PASS' if digits(exp) == digits(got) else 'FAIL'
    if field in ('KyHieu',):
        return 'PASS' if norm(exp) == norm(got) else 'FAIL'
    if field == 'NgayLap':
        return 'PASS' if exp == got else 'FAIL'
    r = difflib.SequenceMatcher(None, norm(exp), norm(got)).ratio()
    return 'PASS' if r == 1 else ('CLOSE' if r >= 0.85 else 'FAIL')


def in_ocr(field, exp, text):
    if exp == '': return None
    t = norm(text)
    if field in NUMERIC: return digits(exp) in digits(text) if field != 'So' else norm(exp) in t
    if field == 'NgayLap':
        y, mo, d = exp.split('-')
        return bool(re.search(r'%d\s*thang\s*%d\s*nam\s*%s' % (int(d), int(mo), y), strip(text), re.I | re.S)) or (d + mo + y) in digits(text)
    e = norm(exp)
    if e in t: return True
    sm = difflib.SequenceMatcher(None, t, e)
    best = max((b.size for b in [sm.find_longest_match(0, len(t), 0, len(e))]), default=0)
    return best / max(1, len(e)) >= 0.9


report, tot = {}, {'PASS': 0, 'CLOSE': 0, 'FAIL': 0, 'FP': 0}
ocr_present = ocr_total = 0
for ep in sorted(glob.glob(os.path.join(LAB, 'expected_output', '*.expected.xml'))):
    name = os.path.basename(ep).replace('.expected.xml', '')
    tp = os.path.join(LAB, 'output', name + '.txt')
    if not os.path.exists(tp): continue
    text = open(tp, encoding='utf-8').read()
    exp = {f: (ET.parse(ep).getroot().findtext(f) or '').strip() for f in FIELDS}
    expflags = [x for x in (ET.parse(ep).getroot().findtext('Flags') or '').split(',') if x]
    got = extract(text)
    gflags = flags(text)
    row = {}
    for f in FIELDS:
        v = judge(f, exp[f], got[f]); tot[v] += 1
        io = in_ocr(f, exp[f], text)
        if io is not None: ocr_total += 1; ocr_present += bool(io)
        row[f] = dict(expected=exp[f], got=got[f], verdict=v, in_ocr=io)
    blank = not got['TgTTTBSo'] and not got['NBan_MST']
    gfl = gflags + (['TRANG'] if blank else [])
    report[name] = dict(fields=row, flags_expected=sorted(expflags), flags_detected=sorted(gfl), flags_ok=sorted(expflags) == sorted(gfl))
    with open(os.path.join(LAB, 'output', name + '.xml'), 'w', encoding='utf-8') as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n<FCCExtracted file="%s">\n' % name)
        for k in FIELDS: f.write('  <%s>%s</%s>\n' % (k, escape(got[k]), k))
        f.write('  <Flags>%s</Flags>\n  <XacMinh>unverified</XacMinh>\n</FCCExtracted>\n' % ','.join(gfl))
n = sum(tot.values())
summary = dict(total_fields=n, **tot, in_ocr=f'{ocr_present}/{ocr_total}',
               flags_ok=sum(r['flags_ok'] for r in report.values()), invoices=len(report))
json.dump(dict(summary=summary, invoices=report), open(os.path.join(LAB, 'output', '_compare.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('SUMMARY', summary)
print('%-28s %s' % ('invoice', ' '.join('%-8s' % f[:8] for f in FIELDS) + ' flags'))
for name, r in report.items():
    print('%-28s %s %s' % (name, ' '.join('%-8s' % r['fields'][f]['verdict'] for f in FIELDS),
                           ('OK ' if r['flags_ok'] else 'X  ') + ','.join(r['flags_detected'])))
