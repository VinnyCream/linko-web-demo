import { request } from './client.js';

// Toàn bộ endpoint FastAPI V7 mà frontend dùng. Khi backend đổi đường dẫn, chỉ sửa ở đây.
// Vai trò cần có ghi bên cạnh (theo security.py: GET employee, POST/PUT/PATCH hr, DELETE admin,
// audit/delete-impact/health/ready hr).

const get = (path, query) => request('GET', path, { query });
const post = (path, body, query) => request('POST', path, { body, query });
const put = (path, body) => request('PUT', path, { body });
const patch = (path, body) => request('PATCH', path, { body });
const del = (path, query, body) => request('DELETE', path, { query, body });

export const api = {
  // Hệ thống
  live: () => get('/api/live'), // public
  health: () => get('/api/health'), // hr
  ready: () => get('/api/ready'), // hr

  // Danh bạ
  employees: ({ q, department_id, status = 'ALL', limit = 500 } = {}) =>
    get('/api/employees', { q, department_id, status, limit }),
  employee: (id) => get(`/api/employees/${id}`),
  profile: (id) => get(`/api/employees/${id}/profile`),
  employeeConnections: (id) => get(`/api/employees/${id}/connections`),
  employeeTeammates: (id) => get(`/api/employees/${id}/teammates`),
  employeeManagers: (id) => get(`/api/employees/${id}/managers`),
  employeeStats: (id) => get(`/api/employees/${id}/stats`),
  commonConnections: (a, b) => get(`/api/employees/${a}/common/${b}`),
  createEmployee: (body) => post('/api/employees', body), // hr
  updateEmployee: (id, body) => patch(`/api/employees/${id}`, body), // hr
  setEmployeeStatus: (id, status) => patch(`/api/data/employees/${id}/status`, { status }), // hr
  bulkStatus: (employee_ids, status) => post('/api/data/employees/bulk-status', { employee_ids, status }), // hr
  softDeleteEmployee: (id) => del(`/api/employees/${id}`), // admin
  hardDeleteEmployee: (id, cascade) => del(`/api/employees/${id}`, { hard: true, confirm: true, cascade: cascade || undefined }), // admin
  employeeImpact: (id) => get(`/api/data/employees/${id}/delete-impact`), // hr
  getManager: (id) => get(`/api/employees/${id}/manager`),
  setManager: (id, manager_id) => put(`/api/employees/${id}/manager`, { manager_id }), // hr
  removeManager: (id) => del(`/api/employees/${id}/manager`), // admin

  // Phòng ban
  departments: () => get('/api/departments'),
  department: (id) => get(`/api/departments/${id}`),
  departmentEmployees: (id) => get(`/api/departments/${id}/employees`),
  departmentProjects: (id) => get(`/api/departments/${id}/projects`),
  createDepartment: (body) => post('/api/departments', body), // hr
  updateDepartment: (id, body) => patch(`/api/departments/${id}`, body), // hr
  deleteDepartment: (id) => del(`/api/departments/${id}`), // admin
  departmentImpact: (id) => get(`/api/data/departments/${id}/delete-impact`), // hr
  transferDepartment: (id, body) => post(`/api/data/departments/${id}/transfer`, body), // hr

  // Dự án
  projects: () => get('/api/projects'),
  project: (id) => get(`/api/projects/${id}`),
  projectMembers: (id) => get(`/api/projects/${id}/members`),
  createProject: (body) => post('/api/projects', body), // hr
  updateProject: (id, body) => patch(`/api/projects/${id}`, body), // hr
  deleteProject: (id, cascade) => del(`/api/projects/${id}`, cascade ? { cascade: true, confirm: true } : undefined), // admin
  projectImpact: (id) => get(`/api/data/projects/${id}/delete-impact`), // hr
  addProjectMember: (id, employee_id, role) => post(`/api/projects/${id}/members`, { employee_id, role }), // hr
  upsertProjectMember: (id, employeeId, body) => put(`/api/data/projects/${id}/members/${employeeId}`, body), // hr
  removeProjectMember: (id, employeeId) => del(`/api/projects/${id}/members/${employeeId}`), // admin

  // Kết nối (Knows)
  connections: ({ employee_id, connection_type, limit = 500, offset = 0 } = {}) =>
    get('/api/connections', { employee_id, connection_type, limit, offset }),
  createConnection: (body) => post('/api/connections', body), // hr
  updateConnection: (from, to, body) => patch(`/api/data/connections/${from}/${to}`, body), // hr
  deleteConnection: (from, to) => del(`/api/data/connections/${from}/${to}`), // admin

  // Đồ thị
  shortestPath: (body) => post('/api/graph/shortest-path', body), // employee (đọc)
  khops: (id, k = 2) => get(`/api/graph/khops/${id}`, { k }),
  teammatesGraph: (id) => get(`/api/graph/teammates/${id}`),
  subordinates: (id) => get(`/api/graph/subordinates/${id}`),
  overview: ({ department_id, limit = 300 } = {}) => get('/api/graph/overview', { department_id, limit }),
  checkTeammate: (emp1, emp2) => get('/api/graph/check-teammate', { emp1, emp2 }),

  // Thống kê, quản trị
  stats: () => get('/api/stats'),
  dashboard: () => get('/api/dashboard/overview'),
  orgSummary: () => get('/api/org/summary'),
  departmentStats: () => get('/api/departments/stats'),
  topConnectors: (limit = 10) => get('/api/stats/top-connectors', { limit }),
  crossDepartment: (limit = 100) => get('/api/stats/cross-department', { limit }),
  projectCollaboration: (limit = 100) => get('/api/stats/project-collaboration', { limit }),
  auditLogs: ({ limit = 500, action } = {}) => get('/api/audit-logs', { limit, action }), // hr
  integrity: () => get('/api/network/integrity'),
};
