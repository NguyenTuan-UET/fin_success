"use client";

// Điểm hiển thị: tính từ dữ liệu đã lọc theo quyền bằng cùng bộ công thức với máy chủ (@fcc/domain).
// Phase WP6 chuyển việc chấm điểm chính thức sang máy chủ; hiện đây là bản tham khảo giống nhau về công thức.
import { useMemo } from "react";
import { applicationScoreOf, buyerScoreOf, esgOf, supplierScoreOf } from "@fcc/domain/engine";
import type { ScoreResult } from "@fcc/domain/credit";
import type { FccState } from "./session";

export function useScores(data: FccState) {
  return useMemo(() => {
    const buyer = new Map<string, ScoreResult>();
    const supplier = new Map<string, ScoreResult>();
    const app = new Map<string, ScoreResult>();
    return {
      buyer: (id: string) => buyer.get(id) ?? (buyer.set(id, buyerScoreOf(data, id)), buyer.get(id)!),
      supplier: (id: string) => supplier.get(id) ?? (supplier.set(id, supplierScoreOf(data, id)), supplier.get(id)!),
      application: (receivableId: string) => app.get(receivableId) ?? (app.set(receivableId, applicationScoreOf(data, receivableId)), app.get(receivableId)!),
      esg: (id: string) => esgOf(data, id),
    };
  }, [data]);
}
