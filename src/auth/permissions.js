// Ma trận quyền khớp với backend/security.py.
// Ẩn nút trên giao diện chỉ để gọn; backend vẫn kiểm tra vai trò ở mọi request.
export const RANK = { employee: 1, hr: 2, admin: 3 };

export function hasRole(actual, required) {
  return (RANK[actual] || 0) >= (RANK[required] || 0);
}

export const can = {
  read: (role) => hasRole(role, 'employee'),
  findPath: (role) => hasRole(role, 'employee'),
  write: (role) => hasRole(role, 'hr'), // POST/PUT/PATCH
  viewAudit: (role) => hasRole(role, 'hr'), // /api/audit-logs, delete-impact, health, ready
  viewAnalytics: (role) => hasRole(role, 'hr'),
  remove: (role) => hasRole(role, 'admin'), // DELETE
  revealPersonal: (role) => hasRole(role, 'hr'), // MaskedField
};

export const ROLE_LABEL = { employee: 'Nhân viên', hr: 'Nhân sự', admin: 'Quản trị viên' };
