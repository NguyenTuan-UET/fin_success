export type Role = "supplier" | "buyer" | "lender" | "admin";

export type IconKey =
  | "overview"
  | "org"
  | "revenue"
  | "log"
  | "invoice"
  | "market"
  | "esg"
  | "accounting"
  | "settings"
  | "users"
  | "shield"
  | "monitor";

export type NavItem = {
  href: string;
  label: string;
  icon: IconKey;
  badge?: string;
  children?: { href: string; label: string }[];
};

export type RoleMeta = {
  role: Role;
  label: string;
  home: string;
  user: { name: string; initials: string; title: string; org: string; greetingName: string };
  nav: NavItem[];
};

export const ROLES: Record<Role, RoleMeta> = {
  supplier: {
    role: "supplier",
    label: "Đơn vị xuất khẩu",
    home: "/supplier",
    user: {
      name: "Nguyễn Lan",
      initials: "NL",
      title: "Kế toán trưởng",
      org: "Vật liệu Sao Mai",
      greetingName: "Lan",
    },
    nav: [
      { href: "/supplier", label: "Tổng quan", icon: "overview" },
      {
        href: "/supplier/invoices",
        label: "Hóa đơn",
        icon: "invoice",
        badge: "3",
        children: [{ href: "/supplier/invoices/upload", label: "Tải hóa đơn OCR/AI" }],
      },
      {
        href: "/supplier/marketplace",
        label: "Marketplace",
        icon: "market",
        children: [
          { href: "/supplier/funding", label: "Hồ sơ tài trợ" },
          { href: "/supplier/disbursement", label: "Giải ngân & thu hồi" },
        ],
      },
      { href: "/supplier/esg", label: "ESG & Xanh", icon: "esg" },
      { href: "/supplier/accounting", label: "Kế toán", icon: "accounting" },
      { href: "/supplier/settings", label: "Cài đặt", icon: "settings" },
    ],
  },
  buyer: {
    role: "buyer",
    label: "Bên nhập khẩu",
    home: "/buyer",
    user: {
      name: "Trần Hùng",
      initials: "TH",
      title: "Giám đốc tài chính",
      org: "Xây dựng Đông Á",
      greetingName: "Hùng",
    },
    nav: [
      { href: "/buyer", label: "Tổng quan", icon: "overview" },
      { href: "/buyer/invoices", label: "Xác nhận hóa đơn", icon: "invoice", badge: "3" },
      { href: "/buyer/marketplace", label: "Marketplace", icon: "market" },
      { href: "/buyer/esg", label: "ESG chuỗi cung ứng", icon: "esg" },
      { href: "/buyer/accounting", label: "Kế toán", icon: "accounting" },
      { href: "/buyer/settings", label: "Cài đặt", icon: "settings" },
    ],
  },
  lender: {
    role: "lender",
    label: "Tổ chức tài chính",
    home: "/lender",
    user: {
      name: "Phạm Minh",
      initials: "PM",
      title: "Chuyên viên thẩm định",
      org: "Quỹ Đầu tư Xanh",
      greetingName: "Minh",
    },
    nav: [
      { href: "/lender", label: "Tổng quan", icon: "overview" },
      {
        href: "/lender/appraisal",
        label: "Thẩm định hồ sơ",
        icon: "invoice",
        badge: "4",
        children: [{ href: "/lender/monitoring", label: "Giám sát & EWS" }],
      },
      { href: "/lender/marketplace", label: "Marketplace", icon: "market" },
      { href: "/lender/esg", label: "ESG & Xanh", icon: "esg" },
      { href: "/lender/accounting", label: "Kế toán được chia sẻ", icon: "accounting" },
      { href: "/lender/settings", label: "Cài đặt", icon: "settings" },
    ],
  },
  admin: {
    role: "admin",
    label: "Quản trị",
    home: "/admin",
    user: {
      name: "Quản trị viên",
      initials: "QT",
      title: "Vận hành nền tảng",
      org: "FCC",
      greetingName: "bạn",
    },
    nav: [
      { href: "/admin", label: "Việc cần xử lý", icon: "overview" },
      { href: "/admin/members", label: "Thành viên & quyền", icon: "users" },
      { href: "/admin/orgs", label: "Tổ chức", icon: "org" },
      { href: "/admin/esg", label: "Thẩm định ESG", icon: "esg" },
      { href: "/admin/sources", label: "Nguồn dữ liệu công khai", icon: "shield" },
      { href: "/admin/revenue", label: "Doanh thu & biểu phí", icon: "revenue" },
      { href: "/admin/audit", label: "Nhật ký kiểm toán", icon: "log" },
      { href: "/admin/settings", label: "Hồ sơ FCC & chia sẻ", icon: "settings" },
    ],
  },
};

export const ROLE_ORDER: Role[] = ["supplier", "buyer", "lender", "admin"];

/** Vai trò giao diện theo loại tổ chức đang hoạt động. */
export function roleOfOrgType(t: "supplier" | "buyer" | "lender" | "fcc"): Role {
  return t === "fcc" ? "admin" : t;
}
export const DEV_ROLE: Record<Role, "supplier" | "buyer" | "lender" | "fcc"> = { supplier: "supplier", buyer: "buyer", lender: "lender", admin: "fcc" };
