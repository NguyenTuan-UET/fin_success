/** Việt Nam dùng UTC+7 cố định (không có giờ mùa hè). */
export const VN_OFFSET_MS = 7 * 3_600_000

/** Ngày nghiệp vụ YYYY-MM-DD theo giờ Việt Nam (không theo UTC — từ 0h đến 7h sáng UTC vẫn là hôm trước). */
export const iso = (d: Date) => new Date(d.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10)

/** Ngày VN của chuỗi ngày hoặc mốc thời gian: "YYYY-MM-DD" giữ nguyên, mốc thời gian đổi theo giờ VN. */
export const dayOf = (s?: string) => (!s ? '' : s.length <= 10 ? s : iso(new Date(s)))

/** 0h giờ VN của ngày "YYYY-MM-DD" — để ngày nhập tay so sánh đúng với mốc thời gian (0h UTC là 7h sáng VN). */
export const vnStartOfDay = (d: string) => new Date(`${d}T00:00:00+07:00`)
