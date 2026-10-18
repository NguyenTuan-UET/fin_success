#!/usr/bin/env python3
"""Lấy dữ liệu bên mua niêm yết qua vnstock (>= 4.0) và ghi JSON cho web demo FCC.

Cách dùng (từ thư mục gốc dự án, dùng venv đã cài vnstock):
    .venv/bin/python scripts/fetch_listed.py HPG --tax-code <MST> [--out server/seed/listed]

Biến môi trường đọc từ scripts/.env (gitignored) nếu chưa có trong môi trường:
    VNSTOCK_API_KEY=...            khóa cộng đồng/sponsor của vnstock
    VNSTOCK_DEVICE_ID=...          ID thiết bị trung tính (tránh vnai băm hostname)
    VNSTOCK_TELEMETRY=off          tắt số liệu đo lường tùy chọn
    VNSTOCK_DISABLE_AGENT_SETUP=1  không cho vnai ghi file hướng dẫn trợ lý AI

Kết quả: <out>/<MÃ>.json gồm `snapshot` (ListedSnapshot) và `financials` (FinancialYear, mới nhất trước).
Máy chủ tự chạy script này (server/src/listed-sync.ts) theo chu kỳ và khi bấm làm mới, rồi nạp file vào hệ thống.

Ghi chú dữ liệu (kiểm tra 12/10/2026 với vnstock 4.0.9):
- Nguồn mặc định KBS trả BCTC năm với NHÃN NĂM BỊ ĐẢO (cột "2025" chứa số liệu 2022 của HPG).
  Script dùng nguồn VCI (nhãn đúng) và tự kiểm tra lại thứ tự năm.
- Bản Cộng đồng: 60 lượt/phút, tối đa 8 kỳ BCTC.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent


def load_env() -> None:
    env = HERE / ".env"
    if env.exists():
        for line in env.read_text(encoding="utf-8").splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())
    os.environ.setdefault("VNSTOCK_TELEMETRY", "off")
    os.environ.setdefault("VNSTOCK_DISABLE_AGENT_SETUP", "1")


# item_id của nguồn VCI -> trường FinancialYear (thử lần lượt)
IS_MAP = {
    "revenue": ["net_sales"],
    "netProfit": ["net_profit_loss_after_tax", "attributable_to_parent_company"],
    "profitBeforeTax": ["net_accounting_profit_loss_before_tax"],
    "interestExpense": ["interest_expenses"],
}
BS_MAP = {
    "totalAssets": ["total_assets", "total_resource"],
    "currentAssets": ["current_assets"],
    "currentLiabilities": ["current_liabilities"],
    "totalLiabilities": ["liabilities"],
    "equity": ["owners_equity"],
    "cash": ["cash_and_cash_equivalents"],
    "inventory": ["inventories_net", "inventories"],
    "receivables": ["accounts_receivable", "trade_accounts_receivable"],
    "longTermBorrowings": ["long_term_borrowings"],
    "charterCapital": ["paid_in_capital", "owners_capital", "common_shares", "charter_capital"],
}
CF_MAP = {
    "operatingCashFlow": ["net_cash_inflows_outflows_from_operating_activities"],
    "depreciation": ["depreciation_and_amortization"],
}


def die(msg: str) -> None:
    print(f"LỖI: {msg}", file=sys.stderr)
    sys.exit(1)


def num(v) -> float:
    try:
        f = float(v)
        return 0.0 if math.isnan(f) else f
    except (TypeError, ValueError):
        return 0.0


def period_cols(df) -> list[str]:
    return [c for c in df.columns if c not in ("item", "item_en", "item_id")]


def pick(df, ids: list[str], col: str) -> float | None:
    for i in ids:
        rows = df[df["item_id"] == i]
        if len(rows):
            return num(rows.iloc[0][col])
    return None


def check_year_order(inc) -> None:
    """Nhãn năm phải giảm dần; cảnh báo nếu nguồn trả nhãn bất thường."""
    years = [int(c) for c in period_cols(inc) if str(c).isdigit()]
    if years != sorted(years, reverse=True):
        die(f"Thứ tự năm bất thường {years} — kiểm tra lại nguồn dữ liệu trước khi dùng.")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("symbol")
    ap.add_argument("--tax-code", required=True, help="MST của doanh nghiệp (ánh xạ MST ↔ mã CK, xác minh thủ công lần đầu)")
    ap.add_argument("--out", default=str(HERE.parent / "server" / "seed" / "listed"))
    ap.add_argument("--exchange", default="HOSE")
    ap.add_argument("--years", type=int, default=3)
    a = ap.parse_args()
    load_env()
    symbol = a.symbol.upper()

    try:
        from vnstock import Fundamental, Market
    except ImportError:
        die("Chưa cài vnstock >= 4. Cài vào venv: pip install --extra-index-url https://vnstocks.com/api/simple vnstock vnai")

    eq = Fundamental().equity(symbol)
    inc = eq.income_statement(period="year", source="vci")
    bs = eq.balance_sheet(period="year", source="vci")
    cf = eq.cash_flow(period="year", source="vci")
    if inc is None or not len(inc):
        die("Không lấy được BCTC từ nguồn VCI.")
    check_year_order(inc)

    financials = []
    for col in [c for c in period_cols(inc) if str(c).isdigit()][: a.years]:
        v = {}
        for df, mp in ((inc, IS_MAP), (bs, BS_MAP), (cf, CF_MAP)):
            if col in df.columns:
                for field, ids in mp.items():
                    x = pick(df, ids, col)
                    if x is not None:
                        v[field] = x
        if not v.get("revenue"):
            continue
        interest = abs(v.get("interestExpense", 0.0))
        financials.append({
            "year": int(col),
            "revenue": v.get("revenue", 0.0),
            "netProfit": v.get("netProfit", 0.0),
            "ebit": v.get("profitBeforeTax", 0.0) + interest,
            "interestExpense": interest,
            "depreciation": abs(v.get("depreciation", 0.0)),
            "totalAssets": v.get("totalAssets", 0.0),
            "currentAssets": v.get("currentAssets", 0.0),
            "currentLiabilities": v.get("currentLiabilities", 0.0),
            "totalLiabilities": v.get("totalLiabilities", 0.0),
            "equity": v.get("equity", 0.0),
            "operatingCashFlow": v.get("operatingCashFlow", 0.0),
            # Không dùng "repayment_of_loans" (gồm vay ngắn hạn xoay vòng); ước lượng: lãi + 20% vay dài hạn
            "debtService": interest + 0.2 * abs(v.get("longTermBorrowings", 0.0)),
            "cash": v.get("cash", 0.0),
            "inventory": v.get("inventory", 0.0),
            "receivables": v.get("receivables", 0.0),
            "source": f"vnstock 4 · VCI · BCTC năm {col}",
            "_charter": v.get("charterCapital", 0.0),
        })
    if not financials:
        die("Không ánh xạ được chỉ tiêu nào — kiểm tra item_id của nguồn VCI.")

    # Kiểm tra chất lượng: số liệu sai cấu trúc thì dừng (giữ nguyên file cũ), lệch nhỏ thì ghi cảnh báo kèm dữ liệu
    warnings: list[str] = []
    for f in financials:
        y, ta, eqt = f["year"], f["totalAssets"], f["equity"]
        if ta <= 0 or f["revenue"] <= 0:
            die(f"BCTC {y}: tổng tài sản hoặc doanh thu không dương — nguồn trả dữ liệu bất thường.")
        if eqt == 0 or f["currentLiabilities"] == 0:
            die(f"BCTC {y}: thiếu vốn chủ sở hữu hoặc nợ ngắn hạn — không tính được hệ số, không ghi dữ liệu.")
        gap = abs(ta - (f["totalLiabilities"] + eqt)) / ta
        if gap > 0.02:
            warnings.append(f"BCTC {y}: tổng tài sản lệch nợ phải trả + vốn chủ {gap:.1%}")
        if f["currentAssets"] > ta * 1.001:
            warnings.append(f"BCTC {y}: tài sản ngắn hạn lớn hơn tổng tài sản")
        if eqt < 0:
            warnings.append(f"BCTC {y}: vốn chủ sở hữu âm")
    if financials[0]["year"] < date.today().year - 2:
        warnings.append(f"BCTC mới nhất là năm {financials[0]['year']} — có thể nguồn chưa cập nhật")
    warnings.append("Nghĩa vụ trả nợ (debtService) là ước tính: lãi vay + 20% vay dài hạn")

    # Quý gần nhất (doanh thu, LNST, LCTT HĐKD)
    quarters = []
    try:
        qi = eq.income_statement(period="quarter", source="vci")
        qc = eq.cash_flow(period="quarter", source="vci")
        for col in period_cols(qi)[:8]:
            quarters.append({
                "period": str(col).replace("-Q", "/Q") if "-Q" in str(col) else str(col),
                "revenue": pick(qi, IS_MAP["revenue"], col) or 0.0,
                "netProfit": pick(qi, IS_MAP["netProfit"], col) or 0.0,
                "operatingCashFlow": (pick(qc, CF_MAP["operatingCashFlow"], col) or 0.0) if col in qc.columns else 0.0,
            })
        # nhãn "2026/Q2" -> "Q2/2026"
        for q in quarters:
            if "/Q" in q["period"]:
                y, n = q["period"].split("/Q")
                q["period"] = f"Q{n}/{y}"
    except Exception as e:  # dữ liệu quý là phụ, không chặn
        print(f"Cảnh báo: không lấy được dữ liệu quý ({e})", file=sys.stderr)

    # Giá 6 tháng (nguồn trả theo nghìn đồng) và biến động 90 phiên năm hóa
    end = date.today()
    px = Market().equity(symbol).ohlcv(start=str(end - timedelta(days=190)), end=str(end), count=200)
    closes = [num(c) for c in px["close"]]
    mult = 1000 if closes and max(closes) < 1000 else 1
    prices = [{"date": str(t)[:10], "close": round(c * mult)} for t, c in zip(px["time"], closes)]
    rets = [math.log(closes[i] / closes[i - 1]) for i in range(max(1, len(closes) - 90), len(closes)) if closes[i - 1] > 0 and closes[i] > 0]
    vol = 0.3
    if len(rets) <= 5:
        warnings.append("Thiếu dữ liệu giá: biến động 90 phiên dùng giá trị mặc định 30%")
    if prices and (end - date.fromisoformat(prices[-1]["date"])).days > 7:
        warnings.append(f"Giá gần nhất là ngày {prices[-1]['date']} — cổ phiếu có thể bị tạm ngừng giao dịch")
    if len(rets) > 5:
        m = sum(rets) / len(rets)
        vol = math.sqrt(sum((r - m) ** 2 for r in rets) / (len(rets) - 1)) * math.sqrt(252)
    charter = financials[0].pop("_charter", 0.0)
    for f in financials:
        f.pop("_charter", None)
    shares = charter / 10_000 if charter else 0
    market_cap = round(shares * prices[-1]["close"]) if shares and prices else 0
    warnings.append("Vốn hóa là ước tính: vốn điều lệ / 10.000 × giá đóng cửa gần nhất" if market_cap else "Không ước tính được vốn hóa (thiếu vốn điều lệ hoặc giá)")

    snapshot = {
        "symbol": symbol,
        "exchange": a.exchange,
        "provider": "vnstock 4 · VCI (BCTC) · KBS (giá)",
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "marketCap": market_cap,
        "volatility90d": round(vol, 4),
        "auditOpinion": "unqualified",  # vnstock không cung cấp; M1/M2 chỉ được chấm sau khi FCC đối chiếu (flagsReviewed)
        "tradingStatus": "normal",  # cần đối chiếu danh sách cảnh báo/kiểm soát của Sở GDCK
        "quarters": quarters,
        "priceHistory": prices,
        "events": [],
        "warnings": warnings,
        "isMock": False,
        "taxCode": a.tax_code,
    }
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    path = out / f"{symbol}.json"
    # ghi ra file tạm rồi đổi tên: máy chủ không bao giờ đọc phải file ghi dở
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps({"snapshot": snapshot, "financials": financials}, ensure_ascii=False, indent=1), encoding="utf-8")
    os.replace(tmp, path)
    f0 = financials[0]
    print(f"Đã ghi {path}")
    print(f"  {len(financials)} năm BCTC (mới nhất {f0['year']}: doanh thu {f0['revenue']/1e12:,.1f} nghìn tỷ, LNST {f0['netProfit']/1e12:,.2f} nghìn tỷ)")
    print(f"  {len(quarters)} quý · {len(prices)} phiên giá · biến động 90 phiên {vol:.0%} · vốn hóa ~{market_cap/1e12:,.0f} nghìn tỷ")
    for w in warnings:
        print(f"  Cảnh báo: {w}")


if __name__ == "__main__":
    main()
