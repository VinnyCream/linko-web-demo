// Mock server cho chế độ demo. Mô phỏng đúng hình dữ liệu và luật phân quyền của FastAPI V7
// (security.py, exceptions.py, crud_v6.py, extended.py, v7_core_compat.py) trên dữ liệu
// sinh từ backend/sql/setup/02_sample_data.sql. Không dùng khi đăng nhập bằng API thật.
import seed from './seed.json';
import { ApiError } from '../client.js';
import { readStore, writeStore } from '../../lib/storage.js';
import { fold } from '../../lib/format.js';

const DB_KEY = 'demo-db-v1';
let db = null;
let warmedUp = false;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function seedAudit(base) {
  const logs = [];
  const sample = base.knows.filter((k) => k.connection_type !== 'TEAMMATE').slice(0, 24);
  const start = Date.now() - 1000 * 60 * 60 * 24 * 12;
  sample.forEach((k, i) => {
    logs.push({
      log_id: i + 1,
      table_name: 'KNOWS',
      action: 'INSERT',
      record_id: `${k.from_emp}->${k.to_emp}`,
      old_value: null,
      new_value: `type=${k.connection_type}; strength=${k.strength}`,
      changed_by: 'SOCIAL_NETWORK',
      changed_at: new Date(start + i * 1000 * 60 * 47 * 6).toISOString(),
    });
  });
  return logs;
}

function load() {
  if (db) return db;
  const saved = readStore(DB_KEY);
  if (saved && saved.version === 1) db = saved;
  else {
    db = { version: 1, ...clone(seed) };
    db.audit_log = seedAudit(db);
  }
  return db;
}

function save() {
  writeStore(DB_KEY, db);
}

export function resetDemoData() {
  db = { version: 1, ...clone(seed) };
  db.audit_log = seedAudit(db);
  save();
}

/* ---------- lỗi giống backend ---------- */
const rid = () => Math.random().toString(16).slice(2, 10) + Math.random().toString(16).slice(2, 10);
function fail(status, code, message) {
  throw new ApiError({ status, code, message, requestId: rid() });
}

/* ---------- phân quyền giống security.py ---------- */
const READ_POST = new Set(['/api/graph/shortest-path', '/api/paths/shortest']);
function requiredRole(method, path) {
  if (path.includes('audit') || path.endsWith('/delete-impact') || path === '/api/health' || path === '/api/ready') return 'hr';
  if (method === 'DELETE') return 'admin';
  if (['POST', 'PATCH', 'PUT'].includes(method) && !READ_POST.has(path)) return 'hr';
  return 'employee';
}
const RANK = { employee: 1, hr: 2, admin: 3 };

/* ---------- truy vấn tiện ích ---------- */
const emp = (id) => db.employees.find((e) => e.employee_id === Number(id));
const dept = (id) => db.departments.find((d) => d.department_id === Number(id));
const proj = (id) => db.projects.find((p) => p.project_id === Number(id));
const managerOf = (id) => db.reports_to.find((r) => r.employee_id === Number(id));

function employeeRow(e) {
  const d = dept(e.department_id);
  const r = managerOf(e.employee_id);
  const m = r ? emp(r.manager_id) : null;
  return {
    employee_id: e.employee_id, full_name: e.full_name, email: e.email, title: e.title, status: e.status,
    department_id: e.department_id, department_name: d?.department_name ?? null,
    manager_id: r?.manager_id ?? null, manager_name: m?.full_name ?? null,
  };
}

function requireEmployee(id, active = false) {
  const e = emp(id);
  if (!e || (active && e.status !== 'ACTIVE')) fail(404, 'EMPLOYEE_NOT_FOUND', 'Nhân viên không tồn tại hoặc không ở trạng thái ACTIVE.');
  return e;
}

function nextId(list, key) {
  return list.reduce((m, x) => Math.max(m, x[key]), 0) + 1;
}

function audit(table, action, recordId, oldValue, newValue, actor) {
  db.audit_log.unshift({
    log_id: nextId(db.audit_log, 'log_id'), table_name: table, action, record_id: String(recordId),
    old_value: oldValue, new_value: newValue, changed_by: actor || 'SOCIAL_NETWORK', changed_at: new Date().toISOString(),
  });
}

function node(type, id, label, title, role) {
  return {
    data: {
      id: (type === 'Project' ? 'proj_' : 'emp_') + id, raw_id: id, label, title: title ?? null, type,
      role_in_path: role ?? null, shape: type === 'Project' ? 'round-rectangle' : 'ellipse',
    },
  };
}

function knowsBetween(ids) {
  const set = new Set(ids);
  return db.knows.filter((k) => set.has(k.from_emp) && set.has(k.to_emp));
}

function syncTeammates(projectId, employeeId, actor) {
  // trg_auto_teammate: tạo TEAMMATE hai chiều với các thành viên hiện có
  const created = [];
  db.project_members
    .filter((m) => m.project_id === projectId && m.employee_id !== employeeId)
    .forEach((m) => {
      [[employeeId, m.employee_id], [m.employee_id, employeeId]].forEach(([a, b]) => {
        if (!db.knows.some((k) => k.from_emp === a && k.to_emp === b)) {
          const rec = { from_emp: a, to_emp: b, connection_type: 'TEAMMATE', strength: 2.0, notes: `Auto-created from project ${projectId}`, since_date: new Date().toISOString().slice(0, 10) };
          db.knows.push(rec);
          created.push({ from_emp: a, to_emp: b, connection_type: 'TEAMMATE', from_name: emp(a)?.full_name, to_name: emp(b)?.full_name });
          audit('KNOWS', 'INSERT', `${a}->${b}`, null, 'type=TEAMMATE; strength=2 (trigger)', actor);
        }
      });
    });
  return created;
}

function cleanupTeammates(employeeId) {
  // Xoá TEAMMATE tự sinh khi hai người không còn dự án chung
  db.knows = db.knows.filter((k) => {
    if (k.connection_type !== 'TEAMMATE' || !String(k.notes || '').startsWith('Auto-created')) return true;
    if (k.from_emp !== employeeId && k.to_emp !== employeeId) return true;
    const a = new Set(db.project_members.filter((m) => m.employee_id === k.from_emp).map((m) => m.project_id));
    return db.project_members.some((m) => m.employee_id === k.to_emp && a.has(m.project_id));
  });
}

/* ---------- đồ thị ---------- */
function adjacency(includeProjects) {
  const adj = new Map();
  const add = (u, v, rec) => {
    if (!adj.has(u)) adj.set(u, []);
    adj.get(u).push({ v, rec });
  };
  const active = new Set(db.employees.filter((e) => e.status === 'ACTIVE').map((e) => e.employee_id));
  db.knows.forEach((k) => {
    if (!active.has(k.from_emp) || !active.has(k.to_emp)) return;
    const rec = { category: 'Knows', detail: k.connection_type, strength: k.strength, direction: `${k.from_emp}->${k.to_emp}` };
    add(`emp_${k.from_emp}`, `emp_${k.to_emp}`, rec);
    add(`emp_${k.to_emp}`, `emp_${k.from_emp}`, rec);
  });
  db.reports_to.forEach((r) => {
    if (!active.has(r.employee_id) || !active.has(r.manager_id)) return;
    const rec = { category: 'ReportsTo', detail: 'Báo cáo trực tiếp (nhân viên → quản lý)', strength: null, direction: `${r.employee_id}->${r.manager_id}` };
    add(`emp_${r.employee_id}`, `emp_${r.manager_id}`, rec);
    add(`emp_${r.manager_id}`, `emp_${r.employee_id}`, rec);
  });
  if (includeProjects) {
    db.project_members.forEach((m) => {
      if (!active.has(m.employee_id)) return;
      const rec = { category: 'WorksOn', detail: `Tham gia dự án: ${m.role || 'MEMBER'}`, strength: null, direction: `emp_${m.employee_id}->proj_${m.project_id}` };
      add(`emp_${m.employee_id}`, `proj_${m.project_id}`, rec);
      add(`proj_${m.project_id}`, `emp_${m.employee_id}`, rec);
    });
  }
  // thứ tự ổn định giống ORDER BY
  adj.forEach((list) => list.sort((a, b) => a.v.localeCompare(b.v, 'en', { numeric: true })));
  return adj;
}

function bfs(adj, source, target, maxHops, limit = 3) {
  const prev = new Map([[source, null]]);
  const depth = new Map([[source, 0]]);
  const queue = [source];
  while (queue.length) {
    const u = queue.shift();
    if (u === target) break;
    if (depth.get(u) >= maxHops) continue;
    for (const { v, rec } of adj.get(u) || []) {
      if (!prev.has(v)) {
        prev.set(v, { u, rec });
        depth.set(v, depth.get(u) + 1);
        queue.push(v);
      }
    }
  }
  if (!prev.has(target)) return [];
  const path = [];
  let cur = target;
  while (prev.get(cur)) {
    const { u, rec } = prev.get(cur);
    path.unshift({ from: u, to: cur, rec });
    cur = u;
  }
  const paths = [path];
  // đường thay thế: chặn lần lượt một đỉnh trung gian
  for (const step of path.slice(0, -1)) {
    if (paths.length >= limit) break;
    const blocked = step.to;
    const p2 = new Map([[source, null]]);
    const d2 = new Map([[source, 0]]);
    const q2 = [source];
    while (q2.length) {
      const u = q2.shift();
      if (u === target || d2.get(u) >= path.length) continue;
      for (const { v, rec } of adj.get(u) || []) {
        if (v === blocked || p2.has(v)) continue;
        p2.set(v, { u, rec });
        d2.set(v, d2.get(u) + 1);
        q2.push(v);
      }
    }
    if (p2.has(target) && d2.get(target) === path.length) {
      const alt = [];
      let c = target;
      while (p2.get(c)) {
        const { u, rec } = p2.get(c);
        alt.unshift({ from: u, to: c, rec });
        c = u;
      }
      paths.push(alt);
    }
  }
  return paths;
}

function vertexInfo(key) {
  const [kind, id] = key.split('_');
  if (kind === 'proj') {
    const p = proj(id);
    return { type: 'Project', id: Number(id), name: p?.project_name ?? `#${id}`, title: null };
  }
  const e = emp(id);
  return { type: 'Employee', id: Number(id), name: e?.full_name ?? `#${id}`, title: e?.title ?? null };
}

function shortestPath(body) {
  const source = Number(body.source_id);
  const target = Number(body.target_id);
  const maxHops = Math.min(6, Math.max(1, Number(body.max_hops || 6)));
  const includeProjects = Boolean(body.include_projects);
  if (source === target) fail(400, 'SELF_CONNECTION', 'Không thể tìm đường kết nối với chính mình.');
  requireEmployee(source, true);
  requireEmployee(target, true);
  const empty = {
    found: false, source_id: source, target_id: target, max_hops: maxHops, include_projects: includeProjects,
    path_length: null, message: 'Không tìm thấy đường kết nối giữa 2 nhân viên này.', steps: [],
    elements: { nodes: [], edges: [] }, alternative_paths: [],
  };
  const effective = includeProjects ? Math.min(maxHops, 5) : maxHops;
  const paths = bfs(adjacency(includeProjects), `emp_${source}`, `emp_${target}`, effective);
  if (!paths.length) return empty;
  const [best, ...alts] = paths;
  const nodes = new Map();
  const steps = [];
  const edges = [];
  best.forEach((s, i) => {
    const a = vertexInfo(s.from);
    const b = vertexInfo(s.to);
    [a, b].forEach((v) => {
      const key = (v.type === 'Project' ? 'proj_' : 'emp_') + v.id;
      if (!nodes.has(key)) nodes.set(key, node(v.type, v.id, v.name, v.title));
    });
    steps.push({
      step: i + 1, from_id: a.id, from_name: a.name, to_id: b.id, to_name: b.name, from_type: a.type, to_type: b.type,
      relation_category: s.rec.category, relation_detail: s.rec.detail, direction: s.rec.direction, strength: s.rec.strength,
    });
    edges.push({ data: { id: `path_edge_${i + 1}_${s.from}_${s.to}`, source: s.from, target: s.to, label: s.rec.detail, category: s.rec.category, strength: s.rec.strength, direction: s.rec.direction } });
  });
  nodes.get(`emp_${source}`).data.role_in_path = 'source';
  nodes.get(`emp_${target}`).data.role_in_path = 'target';
  return {
    found: true, source_id: source, target_id: target, max_hops: maxHops, include_projects: includeProjects,
    path_length: best.length, message: 'Đã tìm thấy đường kết nối ngắn nhất.', steps,
    elements: { nodes: [...nodes.values()], edges },
    alternative_paths: alts.map((p) => ({ node_ids: [p[0].from, ...p.map((s) => s.to)], path_length: p.length })),
  };
}

function khops(id, k) {
  const person = requireEmployee(id, true);
  const adj = new Map();
  const active = new Set(db.employees.filter((e) => e.status === 'ACTIVE').map((e) => e.employee_id));
  db.knows.forEach((x) => {
    if (!active.has(x.from_emp) || !active.has(x.to_emp)) return;
    if (!adj.has(x.from_emp)) adj.set(x.from_emp, new Set());
    if (!adj.has(x.to_emp)) adj.set(x.to_emp, new Set());
    adj.get(x.from_emp).add(x.to_emp);
    adj.get(x.to_emp).add(x.from_emp);
  });
  const hop = new Map([[person.employee_id, 0]]);
  let frontier = [person.employee_id];
  for (let level = 1; level <= k; level += 1) {
    const next = [];
    frontier.forEach((u) => (adj.get(u) || new Set()).forEach((v) => {
      if (!hop.has(v)) {
        hop.set(v, level);
        next.push(v);
      }
    }));
    frontier = next;
  }
  const rows = [...hop.entries()].filter(([eid]) => eid !== person.employee_id).map(([eid, h]) => {
    const e = emp(eid);
    return { employee_id: eid, full_name: e.full_name, title: e.title, department_id: e.department_id, hops: h };
  }).sort((a, b) => a.hops - b.hops || a.employee_id - b.employee_id);
  const ids = [person.employee_id, ...rows.map((r) => r.employee_id)];
  const nodes = [node('Employee', person.employee_id, person.full_name, person.title, 'source'), ...rows.map((r) => node('Employee', r.employee_id, r.full_name, r.title))];
  nodes.forEach((n) => {
    const e = emp(n.data.raw_id);
    n.data.department_id = e?.department_id;
    n.data.hops = hop.get(n.data.raw_id);
  });
  const edges = knowsBetween(ids).map((x) => ({ data: { id: `knows_${x.from_emp}_${x.to_emp}`, source: `emp_${x.from_emp}`, target: `emp_${x.to_emp}`, category: 'Knows', label: x.connection_type, strength: x.strength } }));
  return { data: rows, elements: { nodes, edges }, message: `Mạng lưới trong bán kính ${k} bước.` };
}

function overview(query) {
  const departmentId = query.department_id ? Number(query.department_id) : null;
  const limit = Math.min(300, Number(query.limit || 120));
  const nodes = db.employees
    .filter((e) => e.status === 'ACTIVE' && (!departmentId || e.department_id === departmentId))
    .slice(0, limit)
    .map((e) => ({ employee_id: e.employee_id, full_name: e.full_name, title: e.title, department_id: e.department_id }));
  const ids = new Set(nodes.map((n) => n.employee_id));
  const edges = [
    ...db.knows.filter((k) => ids.has(k.from_emp) && ids.has(k.to_emp)).map((k) => ({ relation_type: 'Knows', source_id: k.from_emp, target_id: k.to_emp, detail: k.connection_type })),
    ...db.reports_to.filter((r) => ids.has(r.employee_id) && ids.has(r.manager_id)).map((r) => ({ relation_type: 'ReportsTo', source_id: r.employee_id, target_id: r.manager_id, detail: 'REPORTS_TO' })),
  ];
  return {
    nodes: nodes.map((n) => ({ ...n, id: n.employee_id, label: n.full_name, group: n.department_id })),
    truncated_edges: false,
    edges: edges.map((e, i) => ({ ...e, id: i + 1, from: e.source_id, to: e.target_id, label: e.detail })),
    elements: {
      nodes: nodes.map((n) => ({ data: { id: `emp_${n.employee_id}`, label: n.full_name, ...n } })),
      edges: edges.map((e, i) => ({ data: { id: `edge_${i}`, source: `emp_${e.source_id}`, target: `emp_${e.target_id}`, ...e } })),
    },
  };
}

function subordinates(id) {
  const root = requireEmployee(id);
  const rows = [];
  const walk = (managerId, level) => {
    if (level > 5) return;
    db.reports_to.filter((r) => r.manager_id === managerId).forEach((r) => {
      const e = emp(r.employee_id);
      if (!e) return;
      rows.push({ employee_id: e.employee_id, full_name: e.full_name, title: e.title, manager_id: managerId, org_level: level, status: e.status, department_id: e.department_id });
      walk(e.employee_id, level + 1);
    });
  };
  walk(root.employee_id, 1);
  const nodes = [node('Employee', root.employee_id, root.full_name, root.title, 'source'), ...rows.map((r) => node('Employee', r.employee_id, r.full_name, r.title))];
  const edges = rows.map((r) => ({ data: { id: `reports_${r.employee_id}_${r.manager_id}`, source: `emp_${r.employee_id}`, target: `emp_${r.manager_id}`, label: 'ReportsTo', category: 'ReportsTo' } }));
  return {
    manager_id: root.employee_id, graph_table: rows, connect_by: rows,
    comparison: { depth_compared: 5, matching: true, only_in_graph: [], only_in_connect_by: [], graph_count: rows.length, connect_by_within_five_count: rows.length },
    elements: { nodes, edges },
  };
}

function stats() {
  const vertices = { employees: db.employees.length, departments: db.departments.length, projects: db.projects.length };
  vertices.total = vertices.employees + vertices.departments + vertices.projects;
  const edges = { reports_to: db.reports_to.length, works_on: db.project_members.length, knows: db.knows.length };
  edges.total = edges.reports_to + edges.works_on + edges.knows;
  const byType = {};
  db.knows.forEach((k) => {
    byType[k.connection_type] = (byType[k.connection_type] || 0) + 1;
  });
  const connection_types = Object.entries(byType).map(([connection_type, total]) => ({ connection_type, total })).sort((a, b) => b.total - a.total);
  return { vertices, edges, audit_logs: db.audit_log.length, connection_types };
}

function impact(kind, id) {
  const map = { employee: [emp, 'employees'], project: [proj, 'projects'], department: [dept, 'departments'] };
  const [finder, table] = map[kind];
  const record = finder(id);
  if (!record) fail(404, 'NOT_FOUND', `Không tìm thấy ${table} #${id}.`);
  const n = Number(id);
  let dependencies;
  if (kind === 'employee') {
    dependencies = {
      memberships: db.project_members.filter((m) => m.employee_id === n).length,
      connections: db.knows.filter((k) => k.from_emp === n || k.to_emp === n).length,
      own_manager: db.reports_to.filter((r) => r.employee_id === n).length,
      direct_reports: db.reports_to.filter((r) => r.manager_id === n).length,
    };
  } else if (kind === 'project') {
    dependencies = { memberships: db.project_members.filter((m) => m.project_id === n).length };
  } else {
    dependencies = { employees: db.employees.filter((e) => e.department_id === n).length, projects: db.projects.filter((p) => p.department_id === n).length };
  }
  return {
    type: kind, id: n, record: clone(record), dependencies, has_dependencies: Object.values(dependencies).some(Boolean),
    cascade_supported: kind !== 'department', warning: 'Xóa cứng không thể hoàn tác; audit_log KNOWS vẫn được giữ.',
  };
}

function validateConnectionType(type) {
  if (type && !['COLLEAGUE', 'FRIEND', 'MENTOR', 'MENTEE', 'TEAMMATE', 'FOLLOW'].includes(type)) fail(422, 'INVALID_CONNECTION_TYPE', 'Loại quan hệ không hợp lệ.');
}

function checkEmail(value, exceptId) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value || '')) fail(422, 'VALIDATION_ERROR', 'email: định dạng email không hợp lệ');
  if (db.employees.some((e) => e.email.toLowerCase() === value.toLowerCase() && e.employee_id !== exceptId)) fail(409, 'DUPLICATE_RECORD', 'Bản ghi hoặc email/kết nối đã tồn tại.');
}

/* ---------- bảng định tuyến ---------- */
const routes = [];
const route = (method, pattern, fn, delay = 'normal') => {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => {
    keys.push(k);
    return '([^/]+)';
  }) + '$');
  routes.push({ method, re, keys, fn, delay });
};

route('GET', '/api/live', () => ({ status: 'running', database: 'not_checked', mode: 'oracle_only' }), 'fast');
route('GET', '/api/health', () => ({ status: 'ok', database: 'FREEPDB1 (demo)', thin_mode: true }));
route('GET', '/api/ready', () => ({ status: 'ready', mode: 'oracle23ai', schema_objects_valid: 15, property_graph: 'enterprise_social_graph' }), 'slow');

route('GET', '/api/employees', ({ query }) => {
  const status = query.status || 'ACTIVE';
  const needle = String(query.q || '').trim().toLowerCase();
  const limit = Math.min(500, Number(query.limit || 100));
  return db.employees
    .filter((e) => status === 'ALL' || e.status === status)
    .filter((e) => !query.department_id || e.department_id === Number(query.department_id))
    .filter((e) => !needle || [e.full_name, e.email, e.title].some((v) => String(v || '').toLowerCase().includes(needle)))
    .sort((a, b) => a.full_name.localeCompare(b.full_name, 'vi') || a.employee_id - b.employee_id)
    .slice(0, limit)
    .map(employeeRow);
});
route('GET', '/api/employees/:id', ({ p }) => {
  const e = emp(p.id);
  if (!e) fail(404, 'NOT_FOUND', `Không tìm thấy employees #${p.id}.`);
  return { ...clone(e), created_at: e.hire_date };
});
route('POST', '/api/employees', ({ body, actor }) => {
  if (!body?.full_name?.trim()) fail(422, 'VALIDATION_ERROR', 'full_name: Field required');
  checkEmail(body.email);
  if (body.department_id && !dept(body.department_id)) fail(404, 'FOREIGN_KEY_NOT_FOUND', 'Đối tượng tham chiếu (Nhân viên/Phòng ban/Dự án) không tồn tại.');
  const rec = { employee_id: nextId(db.employees, 'employee_id'), full_name: body.full_name.trim(), email: body.email.trim(), title: body.title || null, department_id: body.department_id || null, hire_date: body.hire_date || new Date().toISOString().slice(0, 10), phone: body.phone || null, status: body.status || 'ACTIVE' };
  db.employees.push(rec);
  audit('EMPLOYEES', 'INSERT', rec.employee_id, null, `full_name=${rec.full_name}; email=${rec.email}`, actor);
  return clone(rec);
});
const patchEmployee = ({ p, body, actor }) => {
  const e = emp(p.id);
  if (!e) fail(404, 'NOT_FOUND', `Không tìm thấy employees #${p.id}.`);
  if (!body || !Object.keys(body).length) fail(400, 'EMPTY_PATCH', 'Không có trường nào cần cập nhật.');
  if ('email' in body) checkEmail(body.email, e.employee_id);
  if ('full_name' in body && !String(body.full_name || '').trim()) fail(422, 'REQUIRED_FIELD', 'Không được xóa giá trị trường bắt buộc.');
  const before = `title=${e.title}; status=${e.status}; department_id=${e.department_id}`;
  Object.assign(e, body);
  audit('EMPLOYEES', 'UPDATE', e.employee_id, before, `title=${e.title}; status=${e.status}; department_id=${e.department_id}`, actor);
  return clone(e);
};
route('PATCH', '/api/employees/:id', patchEmployee);
route('PUT', '/api/employees/:id', patchEmployee);
route('DELETE', '/api/employees/:id', ({ p, query, actor }) => {
  const e = emp(p.id);
  if (!e) fail(404, 'NOT_FOUND', `Không tìm thấy employees #${p.id}.`);
  const hard = String(query.hard) === 'true';
  const confirm = String(query.confirm) === 'true';
  const cascade = String(query.cascade) === 'true';
  if (!hard) {
    if (cascade || confirm) fail(400, 'HARD_REQUIRED', 'Dùng hard=true để xóa cứng có xác nhận.');
    const previous = e.status;
    e.status = 'INACTIVE';
    audit('EMPLOYEES', 'UPDATE', e.employee_id, `status=${previous}`, 'status=INACTIVE', actor);
    return { success: true, soft_deleted: true, employee_id: e.employee_id, previous_status: previous, status: 'INACTIVE' };
  }
  if (!confirm) fail(400, 'CONFIRM_REQUIRED', 'Xóa cứng yêu cầu hard=true&confirm=true.');
  const info = impact('employee', e.employee_id);
  if (info.has_dependencies && !cascade) fail(409, 'DELETE_HAS_DEPENDENCIES', `Không thể xóa employee #${e.employee_id}: đang được tham chiếu.`);
  if (info.dependencies.direct_reports) fail(409, 'REASSIGN_REPORTS_FIRST', 'Không xóa cứng quản lý còn cấp dưới; gán quản lý mới cho từng người trước.');
  const n = e.employee_id;
  db.project_members = db.project_members.filter((m) => m.employee_id !== n);
  db.knows = db.knows.filter((k) => k.from_emp !== n && k.to_emp !== n);
  db.reports_to = db.reports_to.filter((r) => r.employee_id !== n && r.manager_id !== n);
  db.employees = db.employees.filter((x) => x.employee_id !== n);
  audit('EMPLOYEES', 'DELETE', n, `full_name=${e.full_name}`, null, actor);
  return { success: true, deleted: 1, type: 'employee', deleted_id: n, cascade, previous_dependencies: info.dependencies };
});
route('GET', '/api/employees/:id/profile', ({ p }) => {
  const e = requireEmployee(p.id);
  const id = e.employee_id;
  const row = { ...clone(e), ...employeeRow(e), location: dept(e.department_id)?.location ?? null, created_at: e.hire_date };
  const projects = db.project_members.filter((m) => m.employee_id === id).map((m) => {
    const pr = proj(m.project_id);
    return { project_id: m.project_id, project_name: pr?.project_name, status: pr?.status, role: m.role, join_date: m.join_date };
  }).sort((a, b) => a.project_name.localeCompare(b.project_name, 'vi'));
  const r = managerOf(id);
  const m = r ? emp(r.manager_id) : null;
  const myProjects = new Set(projects.map((x) => x.project_id));
  const teammates = [];
  db.project_members.filter((x) => myProjects.has(x.project_id) && x.employee_id !== id).forEach((x) => {
    const t = emp(x.employee_id);
    if (t && !teammates.some((y) => y.employee_id === t.employee_id && y.project_id === x.project_id)) {
      teammates.push({ employee_id: t.employee_id, full_name: t.full_name, title: t.title, project_id: x.project_id, project_name: proj(x.project_id)?.project_name, role: x.role });
    }
  });
  const social = db.knows.filter((k) => k.from_emp === id || k.to_emp === id).map((k) => {
    const other = emp(k.from_emp === id ? k.to_emp : k.from_emp);
    return { from_emp: k.from_emp, to_emp: k.to_emp, connection_type: k.connection_type, strength: k.strength, since_date: k.since_date, employee_id: other?.employee_id, full_name: other?.full_name, title: other?.title, status: other?.status, direction: k.from_emp === id ? 'outgoing' : 'incoming' };
  }).sort((a, b) => String(a.full_name).localeCompare(String(b.full_name), 'vi'));
  return {
    employee: row,
    network_stats: { outgoing: db.knows.filter((k) => k.from_emp === id).length, incoming: db.knows.filter((k) => k.to_emp === id).length, projects: projects.length },
    projects,
    manager: m ? { employee_id: m.employee_id, full_name: m.full_name, title: m.title, status: m.status } : null,
    direct_reports: db.reports_to.filter((x) => x.manager_id === id).map((x) => emp(x.employee_id)).filter(Boolean).map((x) => ({ employee_id: x.employee_id, full_name: x.full_name, title: x.title, status: x.status })).sort((a, b) => a.full_name.localeCompare(b.full_name, 'vi')),
    teammates,
    social_connections: social,
  };
}, 'medium');
route('GET', '/api/employees/:id/connections', ({ p }) => {
  const id = requireEmployee(p.id).employee_id;
  const seen = new Map();
  db.knows.filter((k) => k.from_emp === id || k.to_emp === id).forEach((k) => {
    const other = emp(k.from_emp === id ? k.to_emp : k.from_emp);
    if (!other) return;
    const key = `${other.employee_id}-${k.connection_type}`;
    if (!seen.has(key)) seen.set(key, { ...employeeRow(other), relation_type: k.connection_type, relation: 'Knows' });
  });
  return [...seen.values()].sort((a, b) => a.full_name.localeCompare(b.full_name, 'vi'));
});
route('GET', '/api/employees/:id/teammates', ({ p }) => {
  const id = requireEmployee(p.id).employee_id;
  const mine = new Set(db.project_members.filter((m) => m.employee_id === id).map((m) => m.project_id));
  const ids = new Set(db.project_members.filter((m) => mine.has(m.project_id) && m.employee_id !== id).map((m) => m.employee_id));
  return [...ids].map((x) => employeeRow(emp(x))).sort((a, b) => a.full_name.localeCompare(b.full_name, 'vi'));
});
route('GET', '/api/employees/:id/managers', ({ p }) => {
  const id = requireEmployee(p.id).employee_id;
  const out = [];
  let cur = managerOf(id);
  let depth = 1;
  while (cur && depth < 20) {
    const m = emp(cur.manager_id);
    if (!m) break;
    out.push({ employee_id: m.employee_id, full_name: m.full_name, title: m.title, status: m.status, department_id: m.department_id, depth });
    cur = managerOf(m.employee_id);
    depth += 1;
  }
  return out;
});
route('GET', '/api/employees/:id/stats', ({ p }) => {
  const id = requireEmployee(p.id).employee_id;
  return { outgoing: db.knows.filter((k) => k.from_emp === id).length, incoming: db.knows.filter((k) => k.to_emp === id).length, projects: db.project_members.filter((m) => m.employee_id === id).length };
});
route('GET', '/api/employees/:id/common/:other', ({ p }) => {
  const a = requireEmployee(p.id).employee_id;
  const b = requireEmployee(p.other).employee_id;
  const nb = (x) => new Set(db.knows.filter((k) => k.from_emp === x || k.to_emp === x).map((k) => (k.from_emp === x ? k.to_emp : k.from_emp)));
  const A = nb(a);
  const B = nb(b);
  return [...A].filter((x) => B.has(x) && x !== a && x !== b).map((x) => employeeRow(emp(x)));
});
route('GET', '/api/employees/:id/manager', ({ p }) => {
  requireEmployee(p.id);
  const r = managerOf(p.id);
  if (!r) return null;
  return { manager_id: r.manager_id, manager_name: emp(r.manager_id)?.full_name, since_date: r.since_date };
});
route('PUT', '/api/employees/:id/manager', ({ p, body, actor }) => {
  const id = Number(p.id);
  const managerId = Number(body?.manager_id);
  if (id === managerId) fail(400, 'SELF_MANAGER', 'Nhân viên không được quản lý chính mình.');
  requireEmployee(id);
  requireEmployee(managerId);
  let cur = managerOf(managerId);
  let guard = 0;
  while (cur && guard < 50) {
    if (cur.manager_id === id) fail(409, 'MANAGEMENT_CYCLE', 'Phân công này tạo chu trình quản lý.');
    cur = managerOf(cur.manager_id);
    guard += 1;
  }
  const existing = managerOf(id);
  if (existing) {
    audit('REPORTS_TO', 'UPDATE', id, `manager_id=${existing.manager_id}`, `manager_id=${managerId}`, actor);
    existing.manager_id = managerId;
    existing.since_date = new Date().toISOString().slice(0, 10);
  } else {
    db.reports_to.push({ employee_id: id, manager_id: managerId, since_date: new Date().toISOString().slice(0, 10) });
    audit('REPORTS_TO', 'INSERT', id, null, `manager_id=${managerId}`, actor);
  }
  return { success: true, employee_id: id, manager_id: managerId };
});
route('DELETE', '/api/employees/:id/manager', ({ p, actor }) => {
  const id = Number(p.id);
  if (!managerOf(id)) fail(404, 'MANAGER_NOT_FOUND', 'Nhân viên chưa có quản lý.');
  db.reports_to = db.reports_to.filter((r) => r.employee_id !== id);
  audit('REPORTS_TO', 'DELETE', id, 'manager removed', null, actor);
  return { success: true, employee_id: id };
});

route('GET', '/api/departments', () => db.departments.map((d) => ({
  department_id: d.department_id, department_name: d.department_name, location: d.location,
  employee_count: db.employees.filter((e) => e.department_id === d.department_id).length,
  active_count: db.employees.filter((e) => e.department_id === d.department_id && e.status === 'ACTIVE').length,
})));
route('GET', '/api/departments/stats', () => db.departments.map((d) => ({
  department_id: d.department_id, department_name: d.department_name, location: d.location,
  employee_count: db.employees.filter((e) => e.department_id === d.department_id).length,
  project_count: db.projects.filter((x) => x.department_id === d.department_id).length,
})));
route('GET', '/api/departments/:id', ({ p }) => {
  const d = dept(p.id);
  if (!d) fail(404, 'NOT_FOUND', `Không tìm thấy departments #${p.id}.`);
  return clone(d);
});
route('GET', '/api/departments/:id/employees', ({ p }) => db.employees.filter((e) => e.department_id === Number(p.id)).map((e) => ({ employee_id: e.employee_id, full_name: e.full_name, email: e.email, title: e.title, status: e.status, department_id: e.department_id })).sort((a, b) => a.full_name.localeCompare(b.full_name, 'vi')));
route('GET', '/api/departments/:id/projects', ({ p }) => db.projects.filter((x) => x.department_id === Number(p.id)).map(clone));
route('POST', '/api/departments', ({ body, actor }) => {
  if (!body?.department_name?.trim()) fail(422, 'VALIDATION_ERROR', 'department_name: Field required');
  const rec = { department_id: nextId(db.departments, 'department_id'), department_name: body.department_name.trim(), location: body.location || null };
  db.departments.push(rec);
  audit('DEPARTMENTS', 'INSERT', rec.department_id, null, `department_name=${rec.department_name}`, actor);
  return clone(rec);
});
const patchDepartment = ({ p, body, actor }) => {
  const d = dept(p.id);
  if (!d) fail(404, 'NOT_FOUND', `Không tìm thấy departments #${p.id}.`);
  if (!body || !Object.keys(body).length) fail(400, 'EMPTY_PATCH', 'Không có trường nào cần cập nhật.');
  if ('department_name' in body && !String(body.department_name || '').trim()) fail(422, 'REQUIRED_FIELD', 'Không được xóa giá trị trường bắt buộc.');
  const before = `department_name=${d.department_name}; location=${d.location}`;
  Object.assign(d, body);
  audit('DEPARTMENTS', 'UPDATE', d.department_id, before, `department_name=${d.department_name}; location=${d.location}`, actor);
  return clone(d);
};
route('PATCH', '/api/departments/:id', patchDepartment);
route('PUT', '/api/departments/:id', patchDepartment);
route('DELETE', '/api/departments/:id', ({ p, actor }) => {
  const info = impact('department', p.id);
  if (info.has_dependencies) fail(409, 'TRANSFER_FIRST', 'Không xóa phòng ban còn nhân sự/dự án; hãy chuyển dữ liệu sang phòng ban khác trước.');
  db.departments = db.departments.filter((d) => d.department_id !== Number(p.id));
  audit('DEPARTMENTS', 'DELETE', p.id, `department_name=${info.record.department_name}`, null, actor);
  return { success: true, deleted: 1, type: 'department', deleted_id: Number(p.id), cascade: false, previous_dependencies: info.dependencies };
});
route('POST', '/api/data/departments/:id/transfer', ({ p, body, actor }) => {
  const from = Number(p.id);
  const to = Number(body?.target_department_id);
  if (from === to) fail(400, 'SAME_DEPARTMENT', 'Phòng chuyển và nhận phải khác nhau.');
  if (!dept(from) || !dept(to)) fail(404, 'NOT_FOUND', 'Không tìm thấy phòng ban.');
  let movedEmployees = 0;
  let movedProjects = 0;
  if (body.move_employees !== false) db.employees.forEach((e) => {
    if (e.department_id === from) {
      e.department_id = to;
      movedEmployees += 1;
    }
  });
  if (body.move_projects !== false) db.projects.forEach((x) => {
    if (x.department_id === from) {
      x.department_id = to;
      movedProjects += 1;
    }
  });
  audit('DEPARTMENTS', 'UPDATE', from, `transfer to ${to}`, `employees=${movedEmployees}; projects=${movedProjects}`, actor);
  return { success: true, from_department_id: from, target_department_id: to, moved_employees: movedEmployees, moved_projects: movedProjects };
});

const projectRow = (x) => ({ ...clone(x), department_name: dept(x.department_id)?.department_name ?? null, member_count: db.project_members.filter((m) => m.project_id === x.project_id).length });
route('GET', '/api/projects', () => db.projects.map(projectRow));
route('GET', '/api/projects/:id', ({ p }) => {
  const x = proj(p.id);
  if (!x) fail(404, 'NOT_FOUND', `Không tìm thấy projects #${p.id}.`);
  return clone(x);
});
route('GET', '/api/projects/:id/members', ({ p }) => {
  if (!proj(p.id)) fail(404, 'NOT_FOUND', `Không tìm thấy projects #${p.id}.`);
  return db.project_members.filter((m) => m.project_id === Number(p.id)).map((m) => {
    const e = emp(m.employee_id);
    return { employee_id: m.employee_id, full_name: e?.full_name, title: e?.title, role: m.role, join_date: m.join_date };
  }).sort((a, b) => String(a.full_name).localeCompare(String(b.full_name), 'vi'));
});
function validateDates(start, end) {
  if (start && end && end < start) fail(422, 'INVALID_DATES', 'Ngày kết thúc phải từ ngày bắt đầu trở đi.');
}
route('POST', '/api/projects', ({ body, actor }) => {
  if (!body?.project_name?.trim()) fail(422, 'VALIDATION_ERROR', 'project_name: Field required');
  validateDates(body.start_date, body.end_date);
  const rec = { project_id: nextId(db.projects, 'project_id'), project_name: body.project_name.trim(), description: body.description || null, start_date: body.start_date || null, end_date: body.end_date || null, status: body.status || 'ACTIVE', department_id: body.department_id || null };
  db.projects.push(rec);
  audit('PROJECTS', 'INSERT', rec.project_id, null, `project_name=${rec.project_name}`, actor);
  return clone(rec);
});
const patchProject = ({ p, body, actor }) => {
  const x = proj(p.id);
  if (!x) fail(404, 'NOT_FOUND', `Không tìm thấy projects #${p.id}.`);
  if (!body || !Object.keys(body).length) fail(400, 'EMPTY_PATCH', 'Không có trường nào cần cập nhật.');
  validateDates(body.start_date ?? x.start_date, body.end_date ?? x.end_date);
  const before = `status=${x.status}; project_name=${x.project_name}`;
  Object.assign(x, body);
  audit('PROJECTS', 'UPDATE', x.project_id, before, `status=${x.status}; project_name=${x.project_name}`, actor);
  return clone(x);
};
route('PATCH', '/api/projects/:id', patchProject);
route('PUT', '/api/projects/:id', patchProject);
route('DELETE', '/api/projects/:id', ({ p, query, actor }) => {
  const cascade = String(query.cascade) === 'true';
  const confirm = String(query.confirm) === 'true';
  if (cascade && !confirm) fail(400, 'CONFIRM_REQUIRED', 'Xóa liên đới yêu cầu cascade=true&confirm=true.');
  const info = impact('project', p.id);
  if (info.has_dependencies && !cascade) fail(409, 'DELETE_HAS_DEPENDENCIES', `Không thể xóa project #${p.id}: đang được tham chiếu.`);
  const n = Number(p.id);
  const affected = db.project_members.filter((m) => m.project_id === n).map((m) => m.employee_id);
  db.project_members = db.project_members.filter((m) => m.project_id !== n);
  affected.forEach(cleanupTeammates);
  db.projects = db.projects.filter((x) => x.project_id !== n);
  audit('PROJECTS', 'DELETE', n, `project_name=${info.record.project_name}`, null, actor);
  return { success: true, deleted: 1, type: 'project', deleted_id: n, cascade, previous_dependencies: info.dependencies };
});
route('POST', '/api/projects/:id/members', ({ p, body, actor }) => {
  const x = proj(p.id);
  if (!x) fail(404, 'FOREIGN_KEY_NOT_FOUND', 'Đối tượng tham chiếu (Nhân viên/Phòng ban/Dự án) không tồn tại.');
  const e = requireEmployee(body?.employee_id, true);
  if (db.project_members.some((m) => m.project_id === x.project_id && m.employee_id === e.employee_id)) fail(409, 'DUPLICATE_RECORD', 'Bản ghi hoặc email/kết nối đã tồn tại.');
  if (['COMPLETED', 'CANCELLED'].includes(x.status)) fail(409, 'PROJECT_CLOSED', 'Không thêm người vào dự án đã hoàn tất/hủy.');
  const before = db.knows.length;
  db.project_members.push({ employee_id: e.employee_id, project_id: x.project_id, role: body.role || 'MEMBER', join_date: new Date().toISOString().slice(0, 10) });
  audit('PROJECT_MEMBERS', 'INSERT', `${x.project_id}:${e.employee_id}`, null, `role=${body.role || 'MEMBER'}`, actor);
  const created = syncTeammates(x.project_id, e.employee_id, actor);
  return {
    message: 'Đã thêm thành viên vào dự án.', project_id: x.project_id, employee_id: e.employee_id, role: body.role || 'MEMBER',
    knows_before: before, knows_after: db.knows.length, net_new_connections: db.knows.length - before,
    new_teammate_edges: created, new_teammate_edge_count: created.length,
    warning: created.length ? null : 'Không có TEAMMATE mới do cạnh đã tồn tại hoặc dự án chưa có đồng đội.',
  };
});
route('PUT', '/api/data/projects/:id/members/:eid', ({ p, body, actor }) => {
  const x = proj(p.id);
  if (!x) fail(404, 'NOT_FOUND', `Không tìm thấy projects #${p.id}.`);
  const e = requireEmployee(p.eid);
  if (e.status !== 'ACTIVE') fail(409, 'INACTIVE_EMPLOYEE', 'Chỉ gán nhân viên ACTIVE vào dự án.');
  const existing = db.project_members.find((m) => m.project_id === x.project_id && m.employee_id === e.employee_id);
  if (!existing && ['COMPLETED', 'CANCELLED'].includes(x.status)) fail(409, 'PROJECT_CLOSED', 'Không thêm người vào dự án đã hoàn tất/hủy.');
  if (existing) {
    audit('PROJECT_MEMBERS', 'UPDATE', `${x.project_id}:${e.employee_id}`, `role=${existing.role}`, `role=${body.role}`, actor);
    existing.role = body.role;
    if (body.join_date) existing.join_date = body.join_date;
  } else {
    db.project_members.push({ employee_id: e.employee_id, project_id: x.project_id, role: body.role, join_date: body.join_date || new Date().toISOString().slice(0, 10) });
    syncTeammates(x.project_id, e.employee_id, actor);
  }
  const rec = db.project_members.find((m) => m.project_id === x.project_id && m.employee_id === e.employee_id);
  return { success: true, created: !existing, record: clone(rec) };
});
route('DELETE', '/api/projects/:id/members/:eid', ({ p, actor }) => {
  const before = db.project_members.length;
  db.project_members = db.project_members.filter((m) => !(m.project_id === Number(p.id) && m.employee_id === Number(p.eid)));
  if (before === db.project_members.length) fail(404, 'MEMBER_NOT_FOUND', 'Không tìm thấy thành viên dự án.');
  cleanupTeammates(Number(p.eid));
  audit('PROJECT_MEMBERS', 'DELETE', `${p.id}:${p.eid}`, 'member removed', null, actor);
  return { success: true, message: 'Đã gỡ thành viên; trigger V5 đồng bộ các quan hệ TEAMMATE tự sinh.' };
});

route('GET', '/api/connections', ({ query }) => {
  validateConnectionType(query.connection_type);
  const eid = query.employee_id ? Number(query.employee_id) : null;
  const offset = Number(query.offset || 0);
  const limit = Math.min(500, Number(query.limit || 100));
  return db.knows
    .filter((k) => !eid || k.from_emp === eid || k.to_emp === eid)
    .filter((k) => !query.connection_type || k.connection_type === query.connection_type)
    .sort((a, b) => a.from_emp - b.from_emp || a.to_emp - b.to_emp)
    .slice(offset, offset + limit)
    .map((k) => ({ ...clone(k), from_name: emp(k.from_emp)?.full_name, to_name: emp(k.to_emp)?.full_name }));
});
route('POST', '/api/connections', ({ body, actor }) => {
  const a = Number(body?.from_emp ?? body?.from_id);
  const b = Number(body?.to_emp ?? body?.to_id);
  if (a === b) fail(400, 'SELF_CONNECTION', 'Không thể tạo quan hệ kết nối với chính mình.');
  if (!emp(a) || !emp(b) || emp(a).status !== 'ACTIVE' || emp(b).status !== 'ACTIVE') fail(404, 'EMPLOYEE_NOT_FOUND', 'Một hoặc cả hai nhân viên không tồn tại hoặc không ở trạng thái ACTIVE.');
  if (db.knows.some((k) => k.from_emp === a && k.to_emp === b)) fail(409, 'CONNECTION_EXISTS', 'Quan hệ kết nối đã tồn tại giữa hai nhân viên này.');
  validateConnectionType(body.connection_type);
  const strength = Number(body.strength ?? 1);
  if (strength < 0 || strength > 5) fail(400, 'CHECK_VIOLATION', 'Dữ liệu vi phạm ràng buộc toàn vẹn (trạng thái, độ mạnh 0-5 hoặc tự kết nối).');
  const rec = { from_emp: a, to_emp: b, connection_type: body.connection_type || 'COLLEAGUE', strength, notes: body.notes || null, since_date: new Date().toISOString().slice(0, 10) };
  db.knows.push(rec);
  audit('KNOWS', 'INSERT', `${a}->${b}`, null, `type=${rec.connection_type}; strength=${strength}`, actor);
  return { success: true, ok: true, message: 'Tạo quan hệ kết nối thành công.', record: clone(rec), audit_log: clone(db.audit_log[0]) };
});
route('GET', '/api/data/connections/:a/:b', ({ p }) => {
  const k = db.knows.find((x) => x.from_emp === Number(p.a) && x.to_emp === Number(p.b));
  if (!k) fail(404, 'NOT_FOUND', `Không tìm thấy KNOWS ${p.a}->${p.b}.`);
  return clone(k);
});
route('PATCH', '/api/data/connections/:a/:b', ({ p, body, actor }) => {
  const k = db.knows.find((x) => x.from_emp === Number(p.a) && x.to_emp === Number(p.b));
  if (!k) fail(404, 'NOT_FOUND', `Không tìm thấy KNOWS ${p.a}->${p.b}.`);
  if (!body || !Object.keys(body).length) fail(400, 'EMPTY_PATCH', 'Cần nhập trường để sửa.');
  validateConnectionType(body.connection_type);
  if ('strength' in body && (body.strength < 0 || body.strength > 5)) fail(400, 'CHECK_VIOLATION', 'Dữ liệu vi phạm ràng buộc toàn vẹn (trạng thái, độ mạnh 0-5 hoặc tự kết nối).');
  const before = `type=${k.connection_type}; strength=${k.strength}`;
  Object.assign(k, body);
  audit('KNOWS', 'UPDATE', `${k.from_emp}->${k.to_emp}`, before, `type=${k.connection_type}; strength=${k.strength}`, actor);
  return { message: 'Cập nhật quan hệ thành công.', record: clone(k), audit_log: clone(db.audit_log[0]) };
});
route('DELETE', '/api/data/connections/:a/:b', ({ p, actor }) => {
  const k = db.knows.find((x) => x.from_emp === Number(p.a) && x.to_emp === Number(p.b));
  if (!k) fail(404, 'NOT_FOUND', `Không tìm thấy KNOWS ${p.a}->${p.b}.`);
  db.knows = db.knows.filter((x) => x !== k);
  audit('KNOWS', 'DELETE', `${k.from_emp}->${k.to_emp}`, `type=${k.connection_type}; strength=${k.strength}`, null, actor);
  return { message: 'Đã xóa quan hệ kết nối.', record: { from_emp: k.from_emp, to_emp: k.to_emp } };
});

route('GET', '/api/data/employees/:id/delete-impact', ({ p }) => impact('employee', p.id));
route('GET', '/api/data/projects/:id/delete-impact', ({ p }) => impact('project', p.id));
route('GET', '/api/data/departments/:id/delete-impact', ({ p }) => impact('department', p.id));
route('PATCH', '/api/data/employees/:id/status', ({ p, body, actor }) => {
  const e = emp(p.id);
  if (!e) fail(404, 'NOT_FOUND', `Không tìm thấy employees #${p.id}.`);
  if (!['ACTIVE', 'INACTIVE', 'ON_LEAVE'].includes(body?.status)) fail(422, 'VALIDATION_ERROR', 'status: giá trị không hợp lệ');
  audit('EMPLOYEES', 'UPDATE', e.employee_id, `status=${e.status}`, `status=${body.status}`, actor);
  e.status = body.status;
  return clone(e);
});
route('POST', '/api/data/employees/bulk-status', ({ body, actor }) => {
  const ids = body?.employee_ids || [];
  const absent = ids.filter((x) => !emp(x));
  if (absent.length) fail(404, 'EMPLOYEES_NOT_FOUND', `Không tìm thấy employee_ids: [${absent.join(', ')}]`);
  ids.forEach((x) => {
    const e = emp(x);
    audit('EMPLOYEES', 'UPDATE', e.employee_id, `status=${e.status}`, `status=${body.status}`, actor);
    e.status = body.status;
  });
  return { success: true, updated: ids.length, employee_ids: ids, status: body.status };
});

route('POST', '/api/graph/shortest-path', ({ body }) => shortestPath(body || {}), 'slow');
route('GET', '/api/graph/khops/:id', ({ p, query }) => khops(p.id, Math.min(3, Math.max(1, Number(query.k || 2)))), 'slow');
route('GET', '/api/graph/overview', ({ query }) => overview(query), 'slow');
route('GET', '/api/graph/subordinates/:id', ({ p }) => subordinates(p.id), 'medium');
route('GET', '/api/graph/teammates/:id', ({ p }) => {
  const me = requireEmployee(p.id);
  const mine = db.project_members.filter((m) => m.employee_id === me.employee_id);
  const nodes = new Map([[`emp_${me.employee_id}`, node('Employee', me.employee_id, me.full_name, me.title, 'source')]]);
  const edges = new Map();
  const rows = [];
  mine.forEach((m) => {
    const pr = proj(m.project_id);
    db.project_members.filter((x) => x.project_id === m.project_id && x.employee_id !== me.employee_id).forEach((x) => {
      const t = emp(x.employee_id);
      rows.push({ proj_id: m.project_id, proj_name: pr.project_name, tm_id: t.employee_id, tm_name: t.full_name, tm_title: t.title, me_role: m.role, tm_role: x.role });
      nodes.set(`proj_${m.project_id}`, node('Project', m.project_id, pr.project_name));
      nodes.set(`emp_${t.employee_id}`, node('Employee', t.employee_id, t.full_name, t.title));
      [[me.employee_id, m.role], [t.employee_id, x.role]].forEach(([who, role]) => edges.set(`works_${who}_${m.project_id}`, { data: { id: `works_${who}_${m.project_id}`, source: `emp_${who}`, target: `proj_${m.project_id}`, category: 'WorksOn', label: role || 'MEMBER' } }));
    });
  });
  return { data: rows, elements: { nodes: [...nodes.values()], edges: [...edges.values()] } };
});
route('GET', '/api/graph/check-teammate', ({ query }) => {
  const a = requireEmployee(query.emp1).employee_id;
  const b = requireEmployee(query.emp2).employee_id;
  const A = new Set(db.project_members.filter((m) => m.employee_id === a).map((m) => m.project_id));
  const yes = db.project_members.some((m) => m.employee_id === b && A.has(m.project_id));
  return { emp1: a, emp2: b, is_teammate: yes, result: yes ? 'YES' : 'NO' };
});

route('GET', '/api/stats', () => stats());
route('GET', '/api/org/summary', () => ({ departments: db.departments.length, projects: db.projects.length, employees: db.employees.length, active_projects: db.projects.filter((x) => x.status === 'ACTIVE').length }));
route('GET', '/api/dashboard/overview', () => {
  const val = stats();
  const top = db.employees.filter((e) => e.status === 'ACTIVE').map((e) => ({
    employee_id: e.employee_id, name: e.full_name, title: e.title, department: dept(e.department_id)?.department_name,
    connections: db.knows.filter((k) => k.from_emp === e.employee_id || k.to_emp === e.employee_id).length,
  })).sort((a, b) => b.connections - a.connections).slice(0, 10);
  return {
    generated_at: new Date().toISOString(),
    stats: { employees: val.vertices.employees, departments: val.vertices.departments, projects: val.vertices.projects, edges_total: val.edges.total, edges_knows: val.edges.knows, edges_reports_to: val.edges.reports_to, edges_works_on: val.edges.works_on, mode: 'oracle23ai' },
    departments: db.departments.map((d) => ({ department_id: d.department_id, name: d.department_name, employee_count: db.employees.filter((e) => e.department_id === d.department_id).length, project_count: db.projects.filter((x) => x.department_id === d.department_id).length })),
    relationships: val.connection_types.map((r) => ({ key: r.connection_type, name: r.connection_type, count: r.total })),
    top_people: top,
    projects: db.projects.slice(0, 25).map((x) => ({ project_id: x.project_id, name: x.project_name, status: x.status, department: dept(x.department_id)?.department_name })),
  };
}, 'slow');
route('GET', '/api/stats/departments', () => db.departments.map((d) => ({ department_id: d.department_id, department_name: d.department_name, employee_count: db.employees.filter((e) => e.department_id === d.department_id).length, active_count: db.employees.filter((e) => e.department_id === d.department_id && e.status === 'ACTIVE').length })));
route('GET', '/api/stats/top-connectors', ({ query }) => db.employees.filter((e) => e.status === 'ACTIVE').map((e) => ({
  employee_id: e.employee_id, full_name: e.full_name, department_name: dept(e.department_id)?.department_name,
  outgoing: db.knows.filter((k) => k.from_emp === e.employee_id).length, incoming: db.knows.filter((k) => k.to_emp === e.employee_id).length,
  projects: db.project_members.filter((m) => m.employee_id === e.employee_id).length,
})).sort((a, b) => b.outgoing - a.outgoing || b.incoming - a.incoming || a.employee_id - b.employee_id).slice(0, Number(query.limit || 10)));
route('GET', '/api/stats/cross-department', ({ query }) => {
  const groups = new Map();
  db.knows.forEach((k) => {
    const a = emp(k.from_emp);
    const b = emp(k.to_emp);
    if (!a || !b || a.status !== 'ACTIVE' || b.status !== 'ACTIVE' || a.department_id === b.department_id) return;
    const lo = Math.min(a.department_id, b.department_id);
    const hi = Math.max(a.department_id, b.department_id);
    const key = `${lo}-${hi}`;
    if (!groups.has(key)) groups.set(key, { source_department_id: lo, source_department: dept(lo)?.department_name, target_department_id: hi, target_department: dept(hi)?.department_name, relation_count: 0 });
    groups.get(key).relation_count += 1;
  });
  return [...groups.values()].sort((a, b) => b.relation_count - a.relation_count || a.source_department_id - b.source_department_id).slice(0, Number(query.limit || 30));
});
route('GET', '/api/stats/project-collaboration', ({ query }) => db.projects.map((x) => {
  const members = db.project_members.filter((m) => m.project_id === x.project_id);
  return { project_id: x.project_id, project_name: x.project_name, status: x.status, member_count: members.length, department_count: new Set(members.map((m) => emp(m.employee_id)?.department_id)).size };
}).sort((a, b) => b.member_count - a.member_count || a.project_id - b.project_id).slice(0, Number(query.limit || 30)));
route('GET', '/api/audit-logs', ({ query }) => db.audit_log.filter((l) => !query.action || l.action === query.action).slice(0, Number(query.limit || 50)).map(clone));
route('GET', '/api/network/integrity', () => {
  const stale = db.knows.filter((k) => {
    if (k.connection_type !== 'TEAMMATE' || !String(k.notes || '').startsWith('Auto-created')) return false;
    const a = new Set(db.project_members.filter((m) => m.employee_id === k.from_emp).map((m) => m.project_id));
    return !db.project_members.some((m) => m.employee_id === k.to_emp && a.has(m.project_id));
  }).length;
  const pairs = new Set();
  const byProject = new Map();
  db.project_members.forEach((m) => {
    if (!byProject.has(m.project_id)) byProject.set(m.project_id, []);
    byProject.get(m.project_id).push(m.employee_id);
  });
  byProject.forEach((ids) => ids.forEach((a) => ids.forEach((b) => a !== b && pairs.add(`${a}-${b}`))));
  const known = new Set(db.knows.map((k) => `${k.from_emp}-${k.to_emp}`));
  const missing = [...pairs].filter((x) => !known.has(x)).length;
  return { status: stale || missing ? 'needs_reconciliation' : 'ok', stale_auto_teammate_edges: stale, missing_shared_project_edges: missing, repair_sql: stale || missing ? 'sql/setup/08_reconcile_teammates.sql' : null };
}, 'medium');

/* ---------- độ trễ mô phỏng ---------- */
const DELAYS = { fast: [60, 160], normal: [220, 650], medium: [500, 1100], slow: [900, 2200] };
function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
}

export async function handle({ method, path, query = {}, body, principal, signal }) {
  load();
  const found = routes.find((r) => r.method === method && r.re.test(path));
  const [lo, hi] = DELAYS[found?.delay || 'normal'];
  // Lần đầu: mô phỏng mở pool kết nối tới Oracle (chậm hơn)
  const extra = warmedUp ? 0 : 1800;
  warmedUp = true;
  await wait(lo + Math.random() * (hi - lo) + extra, signal);
  if (!principal) fail(401, 'AUTH_REQUIRED', 'Cần Bearer access token.');
  if (!found) fail(404, 'NOT_FOUND', 'Không tìm thấy đường dẫn API.');
  const needed = requiredRole(method, path);
  if (RANK[principal.role] < RANK[needed]) fail(403, 'FORBIDDEN', `Cần vai trò ${needed} trở lên.`);
  const match = path.match(found.re);
  const p = Object.fromEntries(found.keys.map((k, i) => [k, decodeURIComponent(match[i + 1])]));
  const result = found.fn({ p, query: query || {}, body, actor: principal.subject });
  if (method !== 'GET') save();
  return clone(result);
}

/** Tìm kiếm không dấu trong dữ liệu demo (dùng cho kiểm thử). */
export function demoSearch(text) {
  load();
  const f = fold(text);
  return db.employees.filter((e) => fold(e.full_name).includes(f));
}
