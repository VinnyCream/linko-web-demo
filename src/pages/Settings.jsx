import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import Avatar from '../components/Avatar.jsx';
import Icon from '../components/Icon.jsx';
import { Button } from '../components/Button.jsx';
import { SegmentedControl, Switch, TextField } from '../components/Form.jsx';
import { RoleBadge } from '../components/Badge.jsx';
import { ConfirmDialog } from '../components/Dialog.jsx';
import { useLocation, useNavigate } from '../lib/router.jsx';
import { usePrefs, useT } from '../state/prefs.jsx';
import { useSession } from '../auth/session.jsx';
import { useToast } from '../components/Toast.jsx';
import { readStore, writeStore } from '../lib/storage.js';
import { formatDateTime } from '../lib/format.js';
import { api } from '../api/endpoints.js';

const SECTIONS = [
  ['avatar', 'Hồ sơ', 'circle-user'],
  ['appearance', 'Giao diện và ngôn ngữ', 'sun'],
  ['notify', 'Thông báo', 'bell'],
  ['session', 'Phiên đăng nhập', 'lock'],
];

export default function Settings() {
  const t = useT();
  const prefs = usePrefs();
  const session = useSession();
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [confirmReset, setConfirmReset] = useState(false);
  const [notify, setNotify] = useState(() => readStore('notify-prefs', { mentions: true, teammates: true, digest: false, sound: false }));
  const [link, setLink] = useState('');
  const [linkState, setLinkState] = useState(null);
  const [linkError, setLinkError] = useState(null);
  const me = session.me;
  const name = me?.full_name || session.subject || '';

  useEffect(() => {
    if (!location.hash) return;
    const el = document.getElementById(location.hash.slice(1));
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [location.hash]);

  const setN = (key) => (value) => {
    const next = { ...notify, [key]: value };
    setNotify(next);
    writeStore('notify-prefs', next);
    toast.show({ tone: 'success', title: t('Đã lưu') });
  };

  const linkEmployee = async (e) => {
    e.preventDefault();
    setLinkState('loading');
    setLinkError(null);
    try {
      const emp = await api.employee(Number(link));
      session.updateMe(emp);
      writeStore('linked-employee', emp.employee_id);
      toast.show({ tone: 'success', title: t('Đã liên kết với hồ sơ {name}', { name: emp.full_name }) });
    } catch {
      setLinkError(t('Không tìm thấy nhân viên với mã này.'));
    } finally {
      setLinkState(null);
    }
  };

  const resetDemo = async () => {
    const mod = await import('../api/mock/server.js');
    mod.resetDemoData();
    Object.keys(window.localStorage).filter((k) => k.startsWith('linko:social:')).forEach((k) => window.localStorage.removeItem(k));
    setConfirmReset(false);
    window.location.reload();
  };

  return (
    <div className="page settings">
      <PageHeader title={t('Cài đặt')} crumbs={[{ label: t('Cài đặt') }]} description={t('Tuỳ chỉnh hồ sơ, giao diện và phiên làm việc của bạn.')} />
      <div className="settings-layout">
        <nav className="settings-nav" aria-label={t('Mục cài đặt')}>
          <ul>
            {SECTIONS.map(([id, label, icon]) => (
              <li key={id}>
                <a href={`#${id}`} className={location.hash === `#${id}` ? 'is-active' : ''}>
                  <Icon name={icon} size={16} />
                  {t(label)}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="settings-body">
          <section id="avatar" className="settings-section" aria-labelledby="s-avatar">
            <h2 id="s-avatar" className="t-h3">{t('Hồ sơ')}</h2>
            {me ? (
              <div className="settings-avatar">
                <Avatar id={me.employee_id} name={name} size="xl" />
                <div>
                  <p className="t-h4">{name}</p>
                  <p className="muted">{me.title}</p>
                  <div className="btn-row">
                    <Button iconStart="circle-user" onClick={() => navigate(`/people/${me.employee_id}`)}>
                      {t('Mở hồ sơ của tôi')}
                    </Button>
                  </div>
                  <p className="muted t-caption">{t('Ảnh đại diện đổi ngay trên hồ sơ: bấm vào ảnh của bạn. Tên, chức danh và phòng ban do bộ phận Nhân sự cập nhật.')}</p>
                </div>
              </div>
            ) : (
              <form className="form-inline" onSubmit={linkEmployee}>
                <p className="muted">{t('Token của bạn chưa gắn với hồ sơ nhân viên. Nhập mã nhân viên (employee_id) để dùng ảnh đại diện, kết nối và bảng tin cá nhân.')}</p>
                <TextField label={t('Mã nhân viên')} inputMode="numeric" value={link} onChange={(e) => setLink(e.target.value.replace(/\D/g, ''))} error={linkError} />
                <Button type="submit" variant="primary" state={linkState} disabled={!link}>
                  {t('Liên kết hồ sơ')}
                </Button>
              </form>
            )}
          </section>

          <section id="appearance" className="settings-section" aria-labelledby="s-appearance">
            <h2 id="s-appearance" className="t-h3">{t('Giao diện và ngôn ngữ')}</h2>
            <div className="setting-row">
              <div>
                <p className="t-label">{t('Giao diện')}</p>
                <p className="muted t-caption">{t('Theo hệ thống sẽ tự đổi theo cài đặt sáng tối của máy bạn.')}</p>
              </div>
              <SegmentedControl
                label={t('Giao diện')}
                value={prefs.themePref}
                onChange={prefs.setTheme}
                options={[
                  { value: 'light', label: t('Sáng'), icon: 'sun' },
                  { value: 'dark', label: t('Tối'), icon: 'moon' },
                  { value: 'system', label: t('Hệ thống'), icon: 'sliders' },
                ]}
              />
            </div>
            <div className="setting-row">
              <div>
                <p className="t-label">{t('Ngôn ngữ')}</p>
                <p className="muted t-caption">{t('Áp dụng cho toàn bộ giao diện. Dữ liệu từ Oracle giữ nguyên.')}</p>
              </div>
              <SegmentedControl
                label={t('Ngôn ngữ')}
                value={prefs.lang}
                onChange={prefs.setLang}
                options={[
                  { value: 'vi', label: 'Tiếng Việt' },
                  { value: 'en', label: 'English' },
                ]}
              />
            </div>
            <Switch checked={prefs.collapsed} onChange={prefs.setCollapsed} label={t('Thu gọn thanh bên')} description={t('Chỉ hiện biểu tượng. Phím tắt Ctrl B.')} />
          </section>

          <section id="notify" className="settings-section" aria-labelledby="s-notify">
            <h2 id="s-notify" className="t-h3">{t('Thông báo')}</h2>
            <Switch checked={notify.mentions} onChange={setN('mentions')} label={t('Khi có người nhắc đến bạn')} />
            <Switch checked={notify.teammates} onChange={setN('teammates')} label={t('Khi bạn có đồng đội mới')} description={t('Từ trigger tạo kết nối khi cùng dự án.')} />
            <Switch checked={notify.digest} onChange={setN('digest')} label={t('Tóm tắt hằng tuần qua email')} description={t('Cần backend hỗ trợ gửi email.')} />
            <Switch checked={notify.sound} onChange={setN('sound')} label={t('Âm báo khi có thông báo mới')} />
          </section>

          <section id="session" className="settings-section" aria-labelledby="s-session">
            <h2 id="s-session" className="t-h3">{t('Phiên đăng nhập')}</h2>
            <dl className="kv">
              <div>
                <dt>{t('Vai trò')}</dt>
                <dd><RoleBadge role={session.role} /></dd>
              </div>
              <div>
                <dt>{t('Chế độ')}</dt>
                <dd>{session.mode === 'demo' ? t('Bản demo') : t('API thật')}</dd>
              </div>
              {session.mode === 'api' && (
                <div>
                  <dt>{t('Địa chỉ API')}</dt>
                  <dd><code className="t-mono-sm">{session.base}</code></dd>
                </div>
              )}
              {session.expiresAt && (
                <div>
                  <dt>{t('Token hết hạn lúc')}</dt>
                  <dd>{formatDateTime(session.expiresAt, prefs.lang)}</dd>
                </div>
              )}
              <div>
                <dt>{t('Bảo mật')}</dt>
                <dd className="muted">{t('Access token chỉ giữ trong bộ nhớ của tab này. Tải lại trang hoặc 15 phút không hoạt động sẽ cần đăng nhập lại.')}</dd>
              </div>
            </dl>
            <div className="btn-row">
              <Button iconStart="arrow-right-from-bracket" onClick={() => session.logout()}>
                {t('Đăng xuất')}
              </Button>
              {session.mode === 'demo' && (
                <Button variant="ghost" iconStart="rotate" onClick={() => setConfirmReset(true)}>
                  {t('Khôi phục dữ liệu demo')}
                </Button>
              )}
            </div>
          </section>
        </div>
      </div>
      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={resetDemo}
        title={t('Khôi phục dữ liệu demo?')}
        description={t('Mọi thay đổi bạn đã làm trong bản demo (nhân viên, kết nối, bài viết) sẽ bị xoá và trang tải lại.')}
        confirmLabel={t('Khôi phục')}
      />
    </div>
  );
}
