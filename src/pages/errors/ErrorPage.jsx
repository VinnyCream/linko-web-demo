import { useEffect, useState } from 'react';
import { Button } from '../../components/Button.jsx';
import { RequestId } from '../../components/Feedback.jsx';
import { useNavigate, useParams } from '../../lib/router.jsx';
import { useT } from '../../state/prefs.jsx';

// Trang lỗi: linh vật + bong bóng mã lỗi (góc đuôi bong bóng lấy từ logo), câu nói rõ chuyện gì xảy ra và bước tiếp theo.
const PAGES = {
  401: { title: 'Phiên đăng nhập đã hết', body: 'Vì lý do bảo mật, Linko không giữ token sau khi tải lại trang hoặc khi hết hạn. Đăng nhập lại để tiếp tục.', primary: ['Đăng nhập lại', '/login'] },
  403: { title: 'Trang này cần quyền cao hơn', body: 'Tài khoản của bạn chưa có vai trò cần thiết. Nếu bạn cần truy cập, liên hệ bộ phận Nhân sự để được cấp quyền.', primary: ['Về Bảng tin', '/'] },
  404: { title: 'Không tìm thấy trang này', body: 'Đường dẫn có thể đã đổi hoặc bị gõ nhầm. Thử tìm bằng ô tìm kiếm ở trên, hoặc quay về Bảng tin.', primary: ['Về Bảng tin', '/'] },
  500: { title: 'Linko gặp sự cố khi hiển thị trang', body: 'Lỗi đã xảy ra phía ứng dụng. Tải lại trang thường sẽ khắc phục; nếu lặp lại, gửi Mã yêu cầu cho nhóm kỹ thuật.', primary: ['Tải lại trang', 'reload'] },
  502: { title: 'Cổng kết nối tới máy chủ đang lỗi', body: 'Đường hầm hoặc proxy giữa Vercel và FastAPI không phản hồi. Thường sẽ ổn lại sau ít phút.', primary: ['Thử lại', 'reload'], auto: true },
  503: { title: 'Chưa kết nối được Oracle 23ai', body: 'Cơ sở dữ liệu đang tạm ngắt hoặc đang khởi động lại. Linko sẽ tự thử lại; bạn không cần làm gì thêm.', primary: ['Thử lại ngay', 'reload'], auto: true },
  504: { title: 'Máy chủ phản hồi quá lâu', body: 'Truy vấn có thể quá nặng. Thử lại hoặc thu hẹp phạm vi tìm kiếm.', primary: ['Thử lại', 'reload'] },
  offline: { title: 'Bạn đang ngoại tuyến', body: 'Kiểm tra Wi-Fi hoặc dây mạng. Linko sẽ tự tải lại khi có mạng.', primary: ['Thử lại', 'reload'] },
  maintenance: { title: 'Linko đang bảo trì', body: 'Nhóm kỹ thuật đang nâng cấp hệ thống. Vui lòng quay lại sau ít phút.', primary: ['Thử lại', 'reload'], auto: true },
};

export default function ErrorPage({ code: codeProp, requestId, detail }) {
  const t = useT();
  const navigate = useNavigate();
  const params = useParams();
  const code = String(codeProp || params.code || '404');
  const page = PAGES[code] || PAGES[404];
  const [left, setLeft] = useState(page.auto ? 15 : 0);

  useEffect(() => {
    document.title = `${t(page.title)} | Linko`;
  }, [page.title, t]);

  useEffect(() => {
    if (!page.auto) return undefined;
    const id = setInterval(() => setLeft((s) => {
      if (s <= 1) {
        window.location.reload();
        return 0;
      }
      return s - 1;
    }), 1000);
    return () => clearInterval(id);
  }, [page.auto]);

  useEffect(() => {
    if (code !== 'offline') return undefined;
    const back = () => window.location.reload();
    window.addEventListener('online', back);
    return () => window.removeEventListener('online', back);
  }, [code]);

  const act = (target) => (target === 'reload' ? window.location.reload() : navigate(target));
  const label = /^\d+$/.test(code) ? code : code === 'offline' ? t('Mất mạng') : t('Bảo trì');

  return (
    <div className="error-page">
      <div className="error-art" aria-hidden="true">
        <span className="error-bubble lk-num">{label}</span>
        <img src="/brand/linko-mark.png" alt="" width="120" height="112" className={code === '404' ? 'tilt' : ''} />
      </div>
      <div className="error-copy">
        <h1 className="t-h1">{t(page.title)}</h1>
        <p className="error-body">{t(page.body)}</p>
        {detail && <p className="muted t-ui">{detail}</p>}
        {page.auto && left > 0 && (
          <p className="error-retry" role="status">
            <span className="spinner" aria-hidden="true" /> {t('Tự thử lại sau {s} giây.', { s: left })}
          </p>
        )}
        <div className="btn-row">
          <Button variant="primary" size="lg" onClick={() => act(page.primary[1])}>
            {t(page.primary[0])}
          </Button>
          {page.primary[1] !== '/' && (
            <Button variant="ghost" size="lg" onClick={() => navigate('/')}>
              {t('Về Bảng tin')}
            </Button>
          )}
          {code === '404' && (
            <Button variant="ghost" size="lg" onClick={() => navigate(-1)}>
              {t('Quay lại trang trước')}
            </Button>
          )}
        </div>
        <RequestId id={requestId} />
      </div>
    </div>
  );
}
