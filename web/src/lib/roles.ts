export type Role = "supplier" | "buyer" | "lender" | "admin";

export type IconKey =
  | "overview"
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
    label: "Nhà cung cấp",
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
    label: "Người mua",
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
      { href: "/lender/accounting", label: "Kế toán", icon: "accounting" },
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
      { href: "/admin", label: "Bảng điều khiển", icon: "overview" },
      { href: "/admin#users", label: "Người dùng & quyền", icon: "users" },
      { href: "/admin#security", label: "Bảo mật & gian lận", icon: "shield" },
      { href: "/admin/settings", label: "Cài đặt hệ thống", icon: "settings" },
    ],
  },
};

export const ROLE_ORDER: Role[] = ["supplier", "buyer", "lender", "admin"];
