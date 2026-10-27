// Viết lại lỗi API thành lời người dùng hiểu. Không hiện mã ORA, SQL hay stack trace.
const BY_CODE = {
  AUTH_REQUIRED: ['Phiên đăng nhập đã hết', 'Đăng nhập lại để tiếp tục.'],
  INVALID_TOKEN: ['Phiên đăng nhập đã hết', 'Access token không hợp lệ hoặc đã hết hạn. Đăng nhập lại để tiếp tục.'],
  INVALID_CLAIMS: ['Token thiếu thông tin', 'Token không có chủ thể hoặc vai trò. Xin token mới từ nhóm backend.'],
  ROLE_REQUIRED: ['Tài khoản chưa có vai trò Linko', 'Token cần một trong các vai trò employee, hr hoặc admin.'],
  FORBIDDEN: ['Bạn chưa có quyền làm việc này', 'Thao tác này cần vai trò cao hơn. Liên hệ Nhân sự nếu bạn cần quyền.'],
  AUTH_CONFIG_ERROR: ['Máy chủ chưa cấu hình xác thực', 'Backend cần JWT_SECRET hoặc OIDC hợp lệ trước khi cấp quyền.'],
  DATABASE_UNAVAILABLE: ['Chưa kết nối được Oracle 23ai', 'Cơ sở dữ liệu đang tạm ngắt. Linko sẽ thử lại sau vài giây.'],
  SCHEMA_NOT_READY: ['Cơ sở dữ liệu chưa sẵn sàng', 'Một số bảng, trigger hoặc property graph chưa hợp lệ. Nhóm backend cần chạy lại script cài đặt.'],
  DATABASE_ERROR: ['Oracle báo lỗi khi xử lý', 'Thao tác chưa hoàn tất. Gửi Mã yêu cầu cho nhóm kỹ thuật để tra log.'],
  NETWORK_ERROR: ['Không gọi được máy chủ', 'Kiểm tra mạng, địa chỉ API (phải là HTTPS khi chạy trên Vercel) và CORS_ORIGINS của backend.'],
  TIMEOUT: ['Máy chủ phản hồi quá lâu', 'Truy vấn đồ thị có thể đang nặng. Thử lại hoặc giảm số bậc tìm kiếm.'],
  BAD_GATEWAY: ['Cổng kết nối tới API đang lỗi', 'Đường hầm hoặc proxy tới FastAPI không phản hồi. Thử lại sau ít phút.'],
  SELF_CONNECTION: ['Không thể chọn cùng một người', 'Chọn hai nhân viên khác nhau.'],
  EMPLOYEE_NOT_FOUND: ['Không tìm thấy nhân viên', 'Người này không tồn tại hoặc không còn làm việc.'],
  CONNECTION_EXISTS: ['Hai người đã kết nối', 'Quan hệ này đã có. Bạn có thể sửa độ mạnh hoặc ghi chú thay vì tạo mới.'],
  CHECK_VIOLATION: ['Dữ liệu chưa hợp lệ', 'Độ mạnh phải từ 0 đến 5 và trạng thái phải hợp lệ.'],
  DUPLICATE_RECORD: ['Dữ liệu đã tồn tại', 'Email hoặc bản ghi này đã được dùng.'],
  FOREIGN_KEY_NOT_FOUND: ['Không tìm thấy dữ liệu liên quan', 'Phòng ban, nhân viên hoặc dự án được chọn không còn tồn tại.'],
  RECORD_IN_USE: ['Dữ liệu đang được dùng', 'Bản ghi đang được tham chiếu ở nơi khác nên chưa xoá được.'],
  DELETE_HAS_DEPENDENCIES: ['Còn dữ liệu phụ thuộc', 'Xem tác động trước khi xoá, hoặc chọn xoá liên đới nếu thật sự cần.'],
  REASSIGN_REPORTS_FIRST: ['Người này còn cấp dưới', 'Gán quản lý mới cho từng cấp dưới trước khi xoá.'],
  TRANSFER_FIRST: ['Phòng ban còn nhân sự hoặc dự án', 'Chuyển nhân sự và dự án sang phòng ban khác trước khi xoá.'],
  MANAGEMENT_CYCLE: ['Phân công tạo vòng lặp quản lý', 'Người được chọn đang là cấp dưới (trực tiếp hoặc gián tiếp) của nhân viên này.'],
  SELF_MANAGER: ['Không thể tự quản lý chính mình', 'Chọn một người quản lý khác.'],
  PROJECT_CLOSED: ['Dự án đã đóng', 'Không thêm người vào dự án đã hoàn tất hoặc đã huỷ.'],
  INACTIVE_EMPLOYEE: ['Nhân viên không còn hoạt động', 'Chỉ gán nhân viên đang làm việc vào dự án.'],
  INVALID_DATES: ['Ngày chưa hợp lệ', 'Ngày kết thúc phải từ ngày bắt đầu trở đi.'],
  GRAPH_TOO_LARGE: ['Mạng lưới quá lớn để vẽ', 'Thử giảm số bậc hoặc lọc theo phòng ban.'],
  PATH_SEARCH_TOO_LARGE: ['Mạng quá dày để dựng đường đi', 'Thử giảm số bậc tối đa.'],
  GRAPH_RESULT_TOO_LARGE: ['Quá nhiều đường đi cùng độ dài', 'Thử giảm số bậc tối đa hoặc bỏ đi qua dự án.'],
  MUTATING_TABLE: ['Trigger dự án đang lỗi', 'Nhóm backend cần cài lại trigger trong 05_fix_auto_teammate_trigger.sql.'],
  EMPTY_PATCH: ['Chưa có thay đổi', 'Sửa ít nhất một trường trước khi lưu.'],
  REQUIRED_FIELD: ['Thiếu trường bắt buộc', 'Không được để trống tên, email hoặc trạng thái.'],
  NOT_FOUND: ['Không tìm thấy dữ liệu', 'Bản ghi có thể đã bị xoá hoặc đường dẫn không đúng.'],
  MEMBER_NOT_FOUND: ['Không tìm thấy thành viên', 'Người này không còn trong dự án.'],
  MANAGER_NOT_FOUND: ['Chưa có quản lý', 'Nhân viên này chưa được gán quản lý trực tiếp.'],
  SAME_DEPARTMENT: ['Chọn phòng ban khác', 'Phòng chuyển và phòng nhận phải khác nhau.'],
  HARD_REQUIRED: ['Thiếu xác nhận xoá cứng', 'Xoá cứng cần xác nhận rõ ràng.'],
  CONFIRM_REQUIRED: ['Thiếu xác nhận', 'Xoá liên đới cần xác nhận rõ ràng.'],
  VALIDATION_ERROR: ['Dữ liệu chưa hợp lệ', ''],
  TOKEN_FORMAT: ['Token không đúng định dạng', 'Dán access token dạng JWT gồm ba phần ngăn bởi dấu chấm.'],
};

export function describeError(error, t = (s) => s) {
  const code = error?.code || 'UNKNOWN';
  const status = error?.status ?? 0;
  const [title, message] = BY_CODE[code] || [
    status >= 500 ? 'Máy chủ gặp sự cố' : 'Chưa thực hiện được',
    error?.message && !/ORA-|SELECT|Traceback/i.test(error.message) ? error.message : 'Thử lại sau ít phút.',
  ];
  const detail = code === 'VALIDATION_ERROR' ? error?.message : '';
  return {
    code,
    status,
    title: t(title),
    message: t(message) + (detail ? ` ${detail}` : ''),
    requestId: error?.requestId || null,
    retryable: status === 0 || status >= 500 || code === 'TIMEOUT',
    kind: status === 403 ? 'forbidden' : status === 404 ? 'notfound' : status === 503 ? 'unavailable' : status === 0 ? 'network' : 'error',
  };
}
