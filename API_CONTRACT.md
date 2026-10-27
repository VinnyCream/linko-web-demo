# Hợp đồng API giữa LinkoWeb và FastAPI V7

Tài liệu cho bạn làm backend. Mọi lời gọi nằm trong `src/api/endpoints.js`; đổi đường dẫn chỉ cần sửa file đó.
Bản demo (`src/api/mock/server.js`) mô phỏng đúng các endpoint dưới đây, nên có thể đối chiếu hình dữ liệu ở đó.

## Quy ước chung

- Header `Authorization: Bearer <JWT>` cho mọi `/api/*` trừ `/api/live`. Frontend giữ token trong bộ nhớ, không gửi cookie (`credentials: 'omit'`).
- Lỗi đọc từ `{"detail": {"code", "message"}}` và header `X-Request-ID`. Lỗi 422 mặc định của FastAPI (`detail` là mảng) cũng được hiểu.
- Frontend phản ứng theo mã: 401 xoá phiên và về đăng nhập; 403 hiện trang không đủ quyền; 503 `DATABASE_UNAVAILABLE` hiện banner và tự thử lại 2, 4, 8 giây; 409/422 hiện lỗi ngay dưới ô nhập.
- Cần thêm domain Vercel vào `CORS_ORIGINS`. Header `X-Request-ID` nên được expose: thêm `expose_headers=["X-Request-ID"]` vào `CORSMiddleware`, nếu không trình duyệt không đọc được Mã yêu cầu khi gọi khác domain.

## Endpoint đang dùng (đã có trong backend V7)

| Màn hình | Method và đường dẫn | Vai trò |
| --- | --- | --- |
| Hệ thống | `GET /api/live`, `GET /api/health`, `GET /api/ready` | public, hr, hr |
| Danh bạ, tìm kiếm | `GET /api/employees?status=ALL&limit=500` | employee |
| Hồ sơ | `GET /api/employees/{id}`, `GET /api/employees/{id}/profile`, `/managers`, `/teammates`, `/common/{other}` | employee |
| Thêm, sửa nhân viên | `POST /api/employees`, `PATCH /api/employees/{id}` | hr |
| Trạng thái | `PATCH /api/data/employees/{id}/status`, `POST /api/data/employees/bulk-status` | hr |
| Xoá nhân viên | `GET /api/data/employees/{id}/delete-impact`, `DELETE /api/employees/{id}` (mềm), `?hard=true&confirm=true[&cascade=true]` | hr, admin |
| Quản lý trực tiếp | `PUT /api/employees/{id}/manager`, `DELETE /api/employees/{id}/manager` | hr, admin |
| Phòng ban | `GET /api/departments`, `/api/departments/stats`, `/api/departments/{id}`, `/{id}/employees`, `/{id}/projects` | employee |
| Sửa, chuyển, xoá phòng ban | `POST/PATCH /api/departments`, `POST /api/data/departments/{id}/transfer`, `GET .../delete-impact`, `DELETE /api/departments/{id}` | hr, hr, hr, admin |
| Dự án | `GET /api/projects`, `/api/projects/{id}`, `/{id}/members` | employee |
| Sửa dự án, thành viên | `POST/PATCH /api/projects`, `POST /api/projects/{id}/members`, `PUT /api/data/projects/{id}/members/{emp}` | hr |
| Xoá dự án, gỡ thành viên | `DELETE /api/projects/{id}[?cascade=true&confirm=true]`, `DELETE /api/projects/{id}/members/{emp}` | admin |
| Kết nối | `GET /api/connections?employee_id=&limit=500` | employee |
| Sửa kết nối | `POST /api/connections`, `PATCH /api/data/connections/{from}/{to}` | hr |
| Xoá kết nối | `DELETE /api/data/connections/{from}/{to}` | admin |
| Bản đồ mạng | `GET /api/graph/khops/{id}?k=1..3`, `GET /api/graph/overview?department_id=&limit=300` | employee |
| Tìm đường | `POST /api/graph/shortest-path` | employee (POST đọc) |
| Sơ đồ tổ chức | `GET /api/graph/subordinates/{id}` | employee |
| Phân tích | `GET /api/dashboard/overview`, `/api/stats/top-connectors`, `/api/stats/cross-department`, `/api/stats/project-collaboration` | employee theo backend, frontend chỉ hiện cho hr |
| Nhật ký | `GET /api/audit-logs?limit=500&action=` | hr |
| Toàn vẹn | `GET /api/network/integrity` | employee theo backend, frontend chỉ hiện cho hr |

## Điểm cần backend xem lại

1. **Quyền đọc phân tích**: `security.py` cho mọi `GET` vai trò employee, nên `/api/stats/*`, `/api/dashboard/overview`, `/api/network/integrity` đang mở cho nhân viên. Frontend đã ẩn với employee, nhưng nếu muốn khoá thật thì thêm các đường dẫn này vào nhánh `hr` của `required_role`.
2. **Che dữ liệu cá nhân**: `GET /api/employees` trả email đầy đủ cho mọi vai trò. Frontend che email/điện thoại bằng `MaskedField`, nhưng che trên giao diện chưa phải bảo mật; nên trả bản đã che cho vai trò employee.
3. **Nhân viên không tự tạo kết nối được**: `POST /api/connections` cần hr. Nếu muốn nhân viên gửi lời mời kết nối, cần endpoint lời mời riêng (đề xuất bên dưới).
4. **`khops` không trả `department_id` trong node**: thêm trường này vào `_node()` để bản đồ tô màu theo phòng ban như chế độ toàn công ty.

## Endpoint đề xuất thêm (frontend đã có giao diện, đang lưu cục bộ)

Các phần này nằm trong `src/state/social.jsx` và `src/state/people.jsx`. Khi backend có endpoint, chỉ cần thay hàm trong hai file đó.

| Tính năng | Đề xuất | Ghi chú |
| --- | --- | --- |
| Người đang đăng nhập | `GET /api/me` trả `{employee_id, role, full_name, ...}` | Hiện frontend đoán từ `sub` của JWT hoặc mã nhân viên người dùng nhập. |
| Ảnh đại diện | `PUT /api/employees/{id}/avatar` (multipart, chỉ chính chủ), `DELETE /api/employees/{id}/avatar`, trả `avatar_url` trong `EmployeeSummary` | Frontend đã cắt vuông 256px JPEG trước khi gửi. Cần thêm cột `avatar_url` hoặc bảng riêng. |
| Trạng thái trực tuyến | `GET /api/presence?ids=1,2,3` trả `{id: "online"|"away"|"offline"}`, `POST /api/presence/heartbeat` mỗi 60 giây | Hiện mô phỏng ổn định theo giờ. |
| Bảng tin | `GET /api/posts?cursor=&limit=10`, `POST /api/posts {text, audience}`, `DELETE /api/posts/{id}`, `POST/DELETE /api/posts/{id}/like`, `POST/DELETE /api/posts/{id}/save`, `GET/POST /api/posts/{id}/comments` | `text` là văn bản thuần, `@[Tên]` và `#[Dự án]` do frontend dựng thành liên kết. Phân trang theo cursor. |
| Sự kiện đồng đội trên bảng tin | Dùng `new_teammate_edges` từ `POST /api/projects/{id}/members` hoặc audit_log `KNOWS INSERT` có notes `Auto-created` | |
| Tin nhắn | `GET /api/conversations`, `GET /api/conversations/{id}/messages?before=`, `POST /api/conversations/{id}/messages`, WebSocket hoặc SSE cho tin mới | |
| Thông báo | `GET /api/notifications?unread=true`, `POST /api/notifications/{id}/read`, `POST /api/notifications/read-all` | Loại: teammate, mention, comment, like, project, system. |
| Lời mời kết nối | `POST /api/connection-requests {to_emp, connection_type, notes}`, `POST /api/connection-requests/{id}/accept`, `/decline` | Cho phép vai trò employee, khi chấp nhận thì tạo Knows. |

Các bảng mới nằm ngoài 7 bảng của đề tài 17, nên chỉ làm nếu nhóm muốn mở rộng.
