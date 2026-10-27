// Điều hướng theo công việc và theo API. role: vai trò tối thiểu để thấy mục (ẩn, không làm mờ).
export const NAV = [
  {
    id: 'ws',
    label: 'Không gian chung',
    items: [
      { id: 'feed', label: 'Bảng tin', icon: 'newspaper', path: '/' },
      { id: 'messages', label: 'Tin nhắn', icon: 'comments', path: '/messages', badge: 'messages' },
      { id: 'notifications', label: 'Thông báo', icon: 'bell', path: '/notifications', badge: 'notifications' },
    ],
  },
  {
    id: 'net',
    label: 'Mạng lưới',
    items: [
      { id: 'connections', label: 'Kết nối của tôi', icon: 'handshake', path: '/connections' },
      { id: 'network', label: 'Bản đồ mạng lưới', icon: 'map', path: '/network' },
      { id: 'path', label: 'Tìm đường kết nối', icon: 'compass', path: '/path' },
    ],
  },
  {
    id: 'org',
    label: 'Tổ chức',
    items: [
      { id: 'directory', label: 'Danh bạ', icon: 'address-book', path: '/directory' },
      { id: 'departments', label: 'Phòng ban', icon: 'building', path: '/departments' },
      { id: 'projects', label: 'Dự án', icon: 'folder', path: '/projects' },
      { id: 'org', label: 'Sơ đồ tổ chức', icon: 'sitemap', path: '/org' },
    ],
  },
  {
    id: 'ins',
    label: 'Phân tích',
    role: 'hr',
    items: [
      { id: 'analytics', label: 'Tổng quan', icon: 'chart-bar', path: '/analytics' },
      { id: 'cross', label: 'Liên kết liên phòng', icon: 'object-group', path: '/analytics/cross-department' },
      { id: 'collab', label: 'Hợp tác dự án', icon: 'clipboard', path: '/analytics/projects' },
    ],
  },
  {
    id: 'adm',
    label: 'Quản trị',
    role: 'hr',
    items: [
      { id: 'audit', label: 'Nhật ký thay đổi', icon: 'file-lines', path: '/admin/audit' },
      { id: 'integrity', label: 'Kiểm tra toàn vẹn', icon: 'circle-check', path: '/admin/integrity' },
      { id: 'system', label: 'Tình trạng hệ thống', icon: 'hard-drive', path: '/admin/system' },
    ],
  },
];

export const NAV_FOOT = [
  { id: 'settings', label: 'Cài đặt', icon: 'gear', path: '/settings' },
  { id: 'help', label: 'Trợ giúp', icon: 'circle-question', path: '/help' },
];

export const NAV_MOBILE = ['feed', 'connections', 'directory', 'notifications'];

export function allNavItems() {
  return [...NAV.flatMap((g) => g.items.map((i) => ({ ...i, group: g.label, role: i.role || g.role }))), ...NAV_FOOT.map((i) => ({ ...i, group: 'Khác' }))];
}

/** Mục điều hướng đang chọn theo đường dẫn. */
export function activeNavId(pathname) {
  const items = allNavItems().sort((a, b) => b.path.length - a.path.length);
  if (pathname.startsWith('/people/')) return 'directory';
  const hit = items.find((i) => (i.path === '/' ? pathname === '/' : pathname === i.path || pathname.startsWith(`${i.path}/`)));
  return hit?.id || null;
}
