"use client";

import { useMemo } from "react";
import { forecastCash, type Forecast } from "@fcc/domain/cashflow";
import type { LedgerItem, Org } from "@fcc/domain/types";
import type { FccState } from "./session";

/** Dự báo dòng tiền của tổ chức: công nợ đã nhập + khoản phải thu/phải trả trên FCC (chưa tất toán). */
export function useCashForecast(data: FccState, org: Org): { forecast: Forecast | null; hasSetup: boolean; openingCash: number } {
  return useMemo(() => {
    const conn = data.connections.find((c) => c.orgId === org.id);
    if (!conn) return { forecast: null, hasSetup: false, openingCash: 0 };
    const fccItems: LedgerItem[] = data.receivables
      .filter((r) => (r.sellerId === org.id || r.buyerId === org.id) && ["BUYER_CONFIRMED", "SUBMITTED", "UNDER_REVIEW", "OFFERED", "ACCEPTED", "FUNDED", "OVERDUE"].includes(r.state))
      .map((r) => {
        const ar = r.sellerId === org.id;
        const other = data.orgs.find((o) => o.id === (ar ? r.buyerId : r.sellerId));
        return { id: `fcc-${r.id}`, orgId: org.id, kind: ar ? "AR" : "AP", counterpartyName: other?.name ?? "", counterpartyTaxCode: other?.taxCode, docNo: r.code, amount: r.amount, paid: 0, dueDate: r.dueDate };
      });
    const own = data.ledger.filter((l) => l.orgId === org.id);
    const forecast = forecastCash(conn, [...own, ...fccItems], data.applications, 90, new Date(), 0);
    return { forecast, hasSetup: true, openingCash: conn.openingCash };
  }, [data, org]);
}
