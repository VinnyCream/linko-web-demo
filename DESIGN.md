# DESIGN.md, LinkoWeb v1.0

Nguồn duy nhất cho quyết định giao diện. Token sinh từ **Linko Design System** (`src/styles/tokens.css`); không thêm màu, cỡ chữ hay bo góc mới mà không cập nhật hệ thống.

## Quyết định thiết kế

- **Người dùng**: nhân viên cần tìm đúng người; Nhân sự cần quản lý dữ liệu và xem mạng lưới; Quản trị viên cần kiểm soát.
- **Việc chính của sản phẩm**: cho thấy ai làm việc với ai và đường ngắn nhất để gặp đúng người.
- **Ý tưởng**: "mỗi đồng nghiệp là một điểm trên đồ thị". Nội dung thật làm trung tâm: đường kết nối (PathTrail) là khoảnh khắc thưởng, bản đồ mạng vẽ từ Property Graph, không dùng hình trang trí.
- **Chữ ký thị giác**: góc đuôi bong bóng `radius-tail` lấy từ logo (mục đang chọn, tooltip, toast, bong bóng chat, lời nhắn chờ, mã lỗi) và ba nét ping khi có thông báo mới. Linh vật chỉ ở logo, màn hình trống, trang lỗi, màn hình mở.
- **Màu**: xanh dương `primary` cho hành động; xanh lá `accent` chỉ cho tín hiệu tích cực (trực tuyến, đồng đội, độ mạnh). Màu loại kết nối `conn-*` dùng cho thẻ, cạnh đồ thị và avatar chữ cái. Dark mode thiết kế riêng (nền navy), không đảo màu.
- **Chữ**: Be Vietnam Pro 400/500/600 (có dấu tiếng Việt xếp chồng), JetBrains Mono chỉ cho mã. Số dùng `tabular-nums`.

## Nâng cấp so với bản design system trước

| Vấn đề | Cách sửa |
| --- | --- |
| Icon thanh bên không thẳng hàng | `Icon` vẽ trong hộp vuông cố định (viewBox vuông, căn giữa), mọi mục điều hướng có cột icon 20px với tâm cách mép 36px ở cả hai trạng thái. Đã đo bằng Playwright: mọi tâm icon tại x = 36. |
| Logo đổi kích thước khi thu gọn | Không đổi ảnh logo sang linh vật nữa: logo luôn cao 32px, khi thu gọn chỉ cắt bề ngang về 34px (phần linh vật), nên linh vật đứng yên đúng cỡ. |
| VI/EN và Sáng/Tối trên thanh trên | Chuyển vào menu tài khoản và trang Cài đặt. Trang đăng nhập giữ một nút nhỏ ở góc. |
| Ô tìm kiếm | Nằm chính giữa thanh trên (lưới 1fr, 560px, 1fr), tìm cả tính năng, thao tác nhanh, đồng nghiệp, phòng ban, dự án; không dấu, từ đồng nghĩa, bàn phím đầy đủ. |
| Thẻ trong thẻ | Panel chỉ có viền, nhóm bên trong tách bằng đường kẻ hoặc nền `surface-sunken`. |
| Cảm giác "AI slop" | Bỏ chữ in hoa toàn bộ cho nhãn, bỏ gradient trang trí, mỗi trang mở bằng câu trả lời cụ thể (ví dụ "117 người đang nối với nhau bằng 804 quan hệ"), con số lớn chỉ khi có ý nghĩa (số bậc tìm đường). |

## Thích ứng theo thiết bị

- **Điện thoại 360 đến 767px**: thanh dưới 5 mục (có vùng an toàn), thanh bên thành ngăn kéo, tìm kiếm mở toàn màn hình, hộp thoại thành sheet từ dưới, bảng thành danh sách ưu tiên hoặc cuộn ngang với cột đầu cố định, tin nhắn dạng danh sách rồi chi tiết.
- **Máy tính bảng 768 đến 1099px**: thanh bên 240px, nút Tạo bài viết chỉ còn icon, cột phụ bảng tin ẩn, cột ít quan trọng của bảng ẩn.
- **Laptop từ 1100px**: đầy đủ, nội dung tối đa 1200px (bản đồ mạng 1440px).
- **Cảm ứng**: nút và mục điều hướng tối thiểu 44px. `prefers-reduced-motion` tắt chuyển động trang trí.

## Trạng thái bắt buộc

Mỗi danh sách, biểu mẫu, thao tác bất đồng bộ có: đang tải (Skeleton đúng hình), chờ lâu (LoadingNote đổi câu mỗi 3,5 giây sau 1,2 đến 1,5 giây), trống (EmptyState có bước tiếp theo), lỗi (Banner hoặc Toast có Mã yêu cầu), thành công (Toast ngắn, có Hoàn tác khi đảo ngược được).

## Biểu đồ

- Chọn dạng theo việc của dữ liệu: phần trên tổng ít nhóm (≤ 6) dùng donut có chú giải; cơ cấu 3 thành phần dùng thanh 100%; độ lớn theo nhiều phòng ban dùng treemap một sắc độ; xếp hạng cặp dùng danh sách tên đầy đủ kèm thanh.
- Màu phân loại `--chart-1..6` theo thứ tự cố định, gắn với loại kết nối (Đồng nghiệp 1, Người hướng dẫn 2, Người được hướng dẫn 3, Theo dõi 4, Bạn bè 5, Đồng đội 6), không theo thứ hạng. Đã chạy validator mù màu cho cả nền sáng và tối; slot 3, 4, 5 tương phản thấp trên nền sáng nên luôn có nhãn và số trong chú giải.
- Màu tuần tự `--seq-1..5` (một sắc xanh, nhạt tới đậm), chế độ tối có bậc riêng.
- Khe 2px màu nền giữa các phần, chữ luôn dùng màu chữ chứ không dùng màu dãy, mọi phần đều có hover hoặc focus hiện số và phần trăm.
- Treemap chọn cách hiện chữ theo kích thước thật của ô; dưới 480px đổi sang danh sách để không cắt chữ.

## Chuyển động

120ms hover, 200ms toggle và hộp thoại, 320ms thanh bên và vẽ đường. Chỉ animate transform và opacity (ngoại lệ: độ rộng thanh bên). Có tên: shake (chuông), beat (Thích), bounce (Lưu), pop (tick, thành công), vẽ PathTrail từng bậc.

## Viết chữ

Tiếng Việt mặc định, gọi người dùng là "bạn", viết hoa kiểu câu, nút nói đúng việc ("Lưu thay đổi" thì toast "Đã lưu thay đổi"), lỗi nói chuyện gì xảy ra và cách sửa, không hiện mã ORA. Không dùng dấu gạch ngang dài. Ngày `dd/MM/yyyy` (tiếng Anh: `MM/dd/yyyy`), số `1.250`, thập phân `4,5`.
