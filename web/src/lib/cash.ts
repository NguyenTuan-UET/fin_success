"use client";

import { useMemo } from "react";
import { orgForecast, type Forecast } from "@fcc/domain/cashflow";
import { statementFor } from "@fcc/domain/statement";
import type { Org } from "@fcc/domain/types";
import type { FccState } from "./session";

/** Dự báo dòng tiền của tổ chức (cùng công thức với máy chủ): số dư từ sao kê giả lập nếu đã liên kết ngân hàng, ngược lại số dư khai báo. */
export function useCashForecast(data: FccState, org: Org): { forecast: Forecast | null; hasSetup: boolean; openingCash: number; bankLinked: boolean } {
  return useMemo(() => {
    const conn = data.connections.find((c) => c.orgId === org.id);
    if (!conn) return { forecast: null, hasSetup: false, openingCash: 0, bankLinked: false };
    const now = new Date();
    const opening = conn.bankLinkedAt ? statementFor(data, org, conn, conn.bankLinkedAt.slice(0, 10), now.toISOString().slice(0, 10)).closing : conn.openingCash;
    return { forecast: orgForecast(data, org, now, 90, opening), hasSetup: true, openingCash: opening, bankLinked: !!conn.bankLinkedAt };
  }, [data, org]);
}
