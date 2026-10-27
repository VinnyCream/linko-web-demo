# LinkoWeb v1.0

Frontend React cho **Linko**, mạng xã hội nội bộ doanh nghiệp chạy trên Oracle Database 23ai (SQL Property Graph) và FastAPI V7.
Đồ án môn Các hệ quản trị cơ sở dữ liệu, HUFLIT.

## Chạy thử trên máy

Yêu cầu Node.js 18 trở lên.

```bash
npm install
npm run dev          # http://localhost:5173
```

Trang đăng nhập có hai cách vào:

| Cách | Khi nào dùng | Ghi chú |
| --- | --- | --- |
| **Bản demo** | Xem giao diện khi chưa chạy backend, hoặc demo trên Vercel | Chạy hoàn toàn trên trình duyệt với 117 nhân viên sinh từ `02_sample_data.sql`. Cùng hình dữ liệu và luật phân quyền với FastAPI V7. Chọn vai trò Nhân viên, Nhân sự hoặc Quản trị viên để thấy giao diện thay đổi theo quyền. |
| **Kết nối API thật** | Khi FastAPI và Oracle đã chạy | Nhập địa chỉ API và access token (JWT). Backend không có endpoint cấp token công khai, nhóm backend cấp token demo bằng `python tools/issue_demo_token.py --sub vinh.ngo --role hr`. |

Nhớ thêm `http://localhost:5173` (và domain Vercel) vào `CORS_ORIGINS` trong `.env` của backend.

## Build và deploy lên Vercel

```bash
npm run build        # xuất ra dist/
npm run preview      # xem bản build ở http://localhost:4173
```

1. Đẩy thư mục này lên GitHub, import vào Vercel (Framework: Vite, tự nhận từ `vercel.json`).
2. Thêm biến môi trường `VITE_API_BASE_URL` = địa chỉ HTTPS của FastAPI (ví dụ qua Cloudflare Tunnel). Để trống nếu chỉ demo.
3. Mở `vercel.json`, thay `https://api.example.com` trong `connect-src` của Content-Security-Policy bằng domain API thật, nếu không trình duyệt sẽ chặn request.
4. Trang Vercel chạy HTTPS nên API cũng phải là HTTPS (trình duyệt chặn mixed content).

Mọi biến `VITE_*` đều công khai trong bundle. Không đặt `JWT_SECRET`, mật khẩu Oracle hay token vào đây.

## Cấu trúc

```
src/
  api/          client.js (fetch, lỗi, token trong bộ nhớ), endpoints.js (mọi endpoint), mock/ (bản demo)
  auth/         session.jsx (đăng nhập, phiên), permissions.js (ma trận quyền theo security.py)
  state/        prefs (giao diện, ngôn ngữ), people (danh bạ, ảnh, trực tuyến), social (bảng tin, tin nhắn, thông báo)
  layout/       AppShell, Sidebar, TopBar, GlobalSearch, BottomNav, ComposeDialog
  components/   Icon, Button, Avatar, Badge, Form, Dialog, Toast, Feedback (Skeleton, EmptyState, Banner, LoadingNote),
                Pagination, PageHeader (Breadcrumbs), PathTrail, NetworkGraph, DataBits, Menu, Tooltip, AvatarEditor, RichText
  pages/        Feed, Messages, Notifications, Connections, Network, PathFinder, Directory, Profile, Departments,
                Projects, OrgChart, Analytics, Admin, Settings, Help, Login, errors/
  lib/          router (History API), format (ngày, số, bỏ dấu), errors (viết lại lỗi), storage, i18n-en, fa-icons
  styles/       tokens.css (sinh từ Linko Design System), base, components, layout, pages
scripts/gen_demo_data.py   sinh src/api/mock/seed.json từ 02_sample_data.sql
```

Phụ thuộc chỉ có React 18 và Vite. Router, đồ thị SVG (bố cục lực), bộ icon Font Awesome Free 7 (108 biểu tượng nhúng sẵn từ Linko Design System) đều viết trong dự án, nên bundle nhẹ và không phụ thuộc thư viện ngoài.

## Tính năng chính

- **Đăng nhập và phân quyền**: token chỉ giữ trong bộ nhớ; nhóm điều hướng, nút ghi/xoá ẩn theo vai trò (employee, hr, admin) khớp `security.py`; trang cần quyền cao hơn hiện 403.
- **Tìm kiếm toàn cục** giữa thanh trên (Ctrl K hoặc /): đồng nghiệp, phòng ban, dự án, tính năng và thao tác nhanh; tìm không dấu ("ke toan" ra Kế toán) và có từ đồng nghĩa.
- **Ngôn ngữ VI/EN và giao diện Sáng/Tối/Theo hệ thống** nằm trong menu tài khoản và trang Cài đặt, không chiếm chỗ trên thanh trên.
- **Bảng tin, tin nhắn, thông báo** (lưu cục bộ vì backend V7 chưa có API), ping chuông khi có thông báo mới. Đủ CRUD cho nội dung của chính mình: đăng, sửa (có nhãn "đã sửa"), xoá bài; bình luận và xoá bình luận; xoá hội thoại, thu hồi tin nhắn; gỡ từng thông báo hoặc dọn thông báo đã đọc. Thao tác xoá đều có Hoàn tác.
- **Kết nối, Bản đồ mạng lưới** (k-hops, toàn công ty, lọc loại quan hệ), **Tìm đường kết nối** (vẽ từng bậc, đường thay thế).
- **Danh bạ** (bảng, lưới, danh sách trên điện thoại, sắp xếp, lọc, phân trang, thao tác hàng loạt), **Hồ sơ** (che email/điện thoại, chuỗi quản lý, đồng đội, kết nối chung), **Phòng ban** (chuyển dữ liệu trước khi xoá), **Dự án** (thêm thành viên, hiện số kết nối Đồng đội trigger vừa tạo), **Sơ đồ tổ chức** (so sánh GRAPH_TABLE với CONNECT BY).
- **Phân tích**: tổng quan dùng thanh 100% cho cơ cấu cạnh đồ thị, donut cho loại kết nối (màu cố định theo loại), treemap nhân sự theo phòng ban (bấm ô để mở phòng, điện thoại tự đổi sang danh sách); liên phòng hiện đủ tên hai phòng, có phân trang và ma trận; hợp tác dự án.
- **Quản trị** (nhật ký có diff, kiểm tra toàn vẹn, tình trạng /api/live, /api/health, /api/ready) cho Nhân sự trở lên.
- **Ảnh đại diện**: đổi hoặc xoá ngay trên hồ sơ của mình (bấm vào ảnh; kéo thả, cắt vuông 256px, Hoàn tác).
- **Mặc định**: giao diện Sáng và tiếng Việt. Ngày hiển thị dd/mm/yyyy khi dùng tiếng Việt, mm/dd/yyyy khi dùng tiếng Anh.
- **Trang đăng nhập**: đồ thị SVG tương tác dựng từ người và quan hệ thật trong dữ liệu mẫu; tín hiệu tự chạy theo đường ngắn nhất tới Tổng Giám đốc, bấm vào ai cũng vẽ đường của người đó.
- **Trạng thái**: Skeleton đúng hình nội dung, lời nhắn thân thiện khi chờ lâu, lỗi có Mã yêu cầu, banner mất kết nối Oracle tự thử lại 2, 4, 8 giây, banner ngoại tuyến, tự đăng xuất sau 15 phút không hoạt động.
- **Trang lỗi** 401, 403, 404, 500, 502, 503, 504, ngoại tuyến, bảo trì (xem tại `/error/503`...).
- **Thích ứng mọi thiết bị**: điện thoại có thanh dưới và ngăn kéo, máy tính bảng, laptop, màn hình lớn; đã kiểm tra không tràn ngang ở 360, 390, 768, 1280px.

## Ghi chú cho nhóm backend

Xem `API_CONTRACT.md`: danh sách endpoint frontend đang gọi và các endpoint đề xuất thêm (bảng tin, tin nhắn, thông báo, ảnh đại diện, trực tuyến, /api/me).
