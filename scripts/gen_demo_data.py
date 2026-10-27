"""Sinh dữ liệu demo từ backend/sql/setup/02_sample_data.sql (tái tạo đúng các quy tắc INSERT ... SELECT).
Chạy: python scripts/gen_demo_data.py path/to/02_sample_data.sql > src/api/mock/seed.json
"""
import json, re, sys
from datetime import date, timedelta

sql = open(sys.argv[1], encoding='utf8').read()
q = r"'((?:[^']|'')*)'"
deps, emps, projects, members, reports, knows = [], [], [], [], [], []

for m in re.finditer(r"INSERT INTO departments \(department_name, location\) VALUES \(" + q + ", " + q + r"\);", sql):
    deps.append({"department_id": len(deps) + 1, "department_name": m[1], "location": m[2]})

for m in re.finditer(r"INSERT INTO employees \(full_name, email, title, department_id, hire_date\) VALUES \(" + q + ", " + q + ", " + q + r", (\d+), DATE '([\d-]+)'\);", sql):
    emps.append({"employee_id": len(emps) + 1, "full_name": m[1], "email": m[2], "title": m[3],
                 "department_id": int(m[4]), "hire_date": m[5], "phone": None, "status": "ACTIVE"})
for level in range(1, 51):
    title = 'Senior Dev' if level % 5 == 0 else ('Developer' if level % 3 == 0 else 'Junior Dev')
    emps.append({"employee_id": len(emps) + 1, "full_name": f"Nhân viên {level}", "email": f"nv{level}@company.vn",
                 "title": title, "department_id": 2 + level % 10,
                 "hire_date": (date(2022, 1, 1) + timedelta(days=level)).isoformat(), "phone": None, "status": "ACTIVE"})

for m in re.finditer(r"INSERT INTO reports_to \(employee_id, manager_id(?:, since_date)?\) VALUES \((\d+), (\d+)(?:, DATE '([\d-]+)')?\);", sql):
    reports.append({"employee_id": int(m[1]), "manager_id": int(m[2]), "since_date": m[3] or "2024-01-01"})

for m in re.finditer(r"INSERT INTO projects \(project_name, description, start_date, status, department_id\) VALUES\s*\(" + q + ", " + q + r", DATE '([\d-]+)', '(\w+)', (\d+)\);", sql):
    projects.append({"project_id": len(projects) + 1, "project_name": m[1], "description": m[2], "start_date": m[3],
                     "end_date": None, "status": m[4], "department_id": int(m[5])})

for m in re.finditer(r"INSERT INTO project_members \(employee_id, project_id, role\) VALUES \((\d+),(\d+),'(\w+)'\);", sql):
    members.append({"employee_id": int(m[1]), "project_id": int(m[2]), "role": m[3], "join_date": "2024-06-01"})
seen = {(x["employee_id"], x["project_id"]) for x in members}
for e in emps:
    for p in projects:
        if 5 <= p["project_id"] <= 15 and (e["employee_id"] + p["project_id"]) % 7 == 0 and e["employee_id"] <= 70:
            if (e["employee_id"], p["project_id"]) not in seen:
                members.append({"employee_id": e["employee_id"], "project_id": p["project_id"], "role": "MEMBER", "join_date": "2024-06-01"})

for m in re.finditer(r"INSERT INTO knows \(from_emp, to_emp, connection_type, strength\) VALUES \((\d+), (\d+), '(\w+)', ([\d.]+)\);", sql):
    knows.append({"from_emp": int(m[1]), "to_emp": int(m[2]), "connection_type": m[3], "strength": float(m[4]), "notes": None, "since_date": "2024-03-01"})
pairs = {(k["from_emp"], k["to_emp"]) for k in knows}
for a in emps:
    for b in emps:
        if a["department_id"] == b["department_id"] and a["employee_id"] < b["employee_id"] and (a["employee_id"] + b["employee_id"]) % 5 == 0 \
           and a["employee_id"] <= 70 and b["employee_id"] <= 70 and (a["employee_id"], b["employee_id"]) not in pairs:
            knows.append({"from_emp": a["employee_id"], "to_emp": b["employee_id"], "connection_type": "COLLEAGUE", "strength": 1.5, "notes": None, "since_date": "2024-03-01"})
            pairs.add((a["employee_id"], b["employee_id"]))
# trg_auto_teammate + 08_reconcile: TEAMMATE hai chiều cho mỗi cặp cùng dự án chưa có Knows
by_project = {}
for x in members:
    by_project.setdefault(x["project_id"], []).append(x["employee_id"])
for pid, ids in sorted(by_project.items()):
    for a in ids:
        for b in ids:
            if a != b and (a, b) not in pairs:
                knows.append({"from_emp": a, "to_emp": b, "connection_type": "TEAMMATE", "strength": 2.0,
                              "notes": f"Auto-created from project {pid}", "since_date": "2024-06-01"})
                pairs.add((a, b))

json.dump({"departments": deps, "employees": emps, "projects": projects, "project_members": members,
           "reports_to": reports, "knows": knows}, sys.stdout, ensure_ascii=False, separators=(',', ':'))
print(f"deps={len(deps)} emps={len(emps)} projects={len(projects)} members={len(members)} reports={len(reports)} knows={len(knows)}", file=sys.stderr)
