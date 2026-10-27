import { useEffect } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import { ConnectionTag, CONNECTION_TYPES } from '../components/Badge.jsx';
import { useLocation } from '../lib/router.jsx';
import { useT } from '../state/prefs.jsx';

const SHORTCUTS = [
  [['Ctrl', 'K'], 'Mở tìm kiếm'],
  [['/'], 'Mở tìm kiếm khi không gõ chữ'],
  [['Ctrl', 'B'], 'Thu gọn hoặc mở rộng thanh bên'],
  [['Alt', 'N'], 'Tạo bài viết'],
  [['Ctrl', 'Enter'], 'Đăng bài khi đang soạn'],
  [['?'], 'Mở trang này'],
  [['Esc'], 'Đóng hộp thoại, menu hoặc kết quả tìm kiếm'],
];

const FAQ = [
  ['Đồng đội khác Đồng nghiệp thế nào?', 'Đồng đội được tạo tự động khi hai người cùng ít nhất một dự án (trigger trg_auto_teammate). Đồng nghiệp và các loại khác do bộ phận Nhân sự ghi nhận.'],
  ['Vì sao tôi không thấy nút sửa hay xoá?', 'Thao tác ghi cần vai trò Nhân sự, thao tác xoá cần Quản trị viên. Linko ẩn những gì vượt quyền của bạn; máy chủ vẫn kiểm tra quyền ở mọi yêu cầu.'],
  ['Vì sao email đồng nghiệp bị che?', 'Thông tin cá nhân chỉ Nhân sự và Quản trị viên mở được, và tự che lại sau 15 giây.'],
  ['Tìm đường kết nối dùng dữ liệu nào?', 'Kết nối (Knows), quan hệ báo cáo (ReportsTo) và tuỳ chọn dự án chung (WorksOn) trong Oracle SQL Property Graph, tối đa 6 bậc.'],
  ['Khi báo lỗi tôi cần gửi gì?', 'Gửi Mã yêu cầu hiện trong thông báo lỗi. Nhóm kỹ thuật dùng mã này để tìm đúng dòng log.'],
];

export default function Help() {
  const t = useT();
  const location = useLocation();
  useEffect(() => {
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [location.hash]);
  return (
    <div className="page page-narrow">
      <PageHeader title={t('Trợ giúp')} crumbs={[{ label: t('Trợ giúp') }]} description={t('Phím tắt, thuật ngữ và câu hỏi thường gặp.')} />
      <section id="shortcuts" className="panel" aria-labelledby="h-short">
        <h2 id="h-short" className="t-h4 panel-title">{t('Phím tắt')}</h2>
        <dl className="shortcuts">
          {SHORTCUTS.map(([keys, label]) => (
            <div key={label}>
              <dt>
                {keys.map((k) => (
                  <kbd key={k}>{k}</kbd>
                ))}
              </dt>
              <dd>{t(label)}</dd>
            </div>
          ))}
        </dl>
        <p className="muted t-caption">{t('Trên Mac dùng ⌘ thay cho Ctrl.')}</p>
      </section>
      <section className="panel" aria-labelledby="h-terms">
        <h2 id="h-terms" className="t-h4 panel-title">{t('Các loại kết nối')}</h2>
        <ul className="term-list">
          {Object.keys(CONNECTION_TYPES).map((k) => (
            <li key={k}>
              <ConnectionTag type={k} auto={k === 'TEAMMATE'} />
            </li>
          ))}
        </ul>
      </section>
      <section className="panel" aria-labelledby="h-faq">
        <h2 id="h-faq" className="t-h4 panel-title">{t('Câu hỏi thường gặp')}</h2>
        <div className="faq">
          {FAQ.map(([q, a]) => (
            <details key={q}>
              <summary>{t(q)}</summary>
              <p>{t(a)}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
