import { useEffect, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { Button, IconButton } from '../components/Button.jsx';
import { TextField } from '../components/Form.jsx';
import { Banner, LoadingNote } from '../components/Feedback.jsx';
import Avatar from '../components/Avatar.jsx';
import { useNavigate } from '../lib/router.jsx';
import { usePrefs, useT } from '../state/prefs.jsx';
import { DEMO_PERSONAS, useSession } from '../auth/session.jsx';
import { describeError } from '../lib/errors.js';
import { formatNumber } from '../lib/format.js';
import LoginGraph from '../components/LoginGraph.jsx';

const PERSONA_INFO = {
  employee: { name: 'Ngô Văn Vinh', title: 'Junior Backend, Phòng Công nghệ', role: 'Nhân viên', can: 'Xem danh bạ, mạng lưới, tìm đường kết nối.' },
  hr: { name: 'Đỗ Thị Nga', title: 'HR Manager, Phòng Nhân sự', role: 'Nhân sự', can: 'Thêm, sửa nhân viên, dự án, kết nối; xem phân tích và nhật ký.' },
  admin: { name: 'Lê Minh Cường', title: 'Giám đốc Công nghệ', role: 'Quản trị viên', can: 'Toàn quyền, gồm cả xoá dữ liệu.' },
};

function CountUp({ to, ms = 1200 }) {
  const { lang } = usePrefs();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setN(to);
      return undefined;
    }
    const t0 = performance.now();
    let raf;
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / ms);
      setN(Math.round(to * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, ms]);
  return <span className="lk-num">{formatNumber(n, lang)}</span>;
}

function BrandPanel() {
  const t = useT();
  return (
    <aside className="login-brand" aria-label={t('Giới thiệu Linko')}>
      <div className="login-brand-top">
        <img src="/brand/linko-logo.png" alt="Linko" className="login-logo" width="160" height="60" />
        <h1 className="login-headline">{t('Mỗi đồng nghiệp là một điểm trên đồ thị.')}</h1>
        <p className="login-lead">{t('Linko cho bạn thấy ai làm việc với ai, và đường ngắn nhất để gặp đúng người trong công ty.')}</p>
      </div>
      <div className="login-stage">
        <LoginGraph />
      </div>
      <dl className="login-stats">
        <div>
          <dt>{t('nhân viên')}</dt>
          <dd><CountUp to={117} /></dd>
        </div>
        <div>
          <dt>{t('quan hệ Knows')}</dt>
          <dd><CountUp to={804} ms={1500} /></dd>
        </div>
        <div>
          <dt>{t('dự án')}</dt>
          <dd><CountUp to={15} ms={900} /></dd>
        </div>
        <p className="login-stats-note">{t('Số liệu từ dữ liệu mẫu của đồ án')}</p>
      </dl>
    </aside>
  );
}

export default function Login() {
  const t = useT();
  const prefs = usePrefs();
  const session = useSession();
  const navigate = useNavigate();
  const [mode, setMode] = useState(session.savedBase ? 'api' : 'demo');
  const [persona, setPersona] = useState('employee');
  const [base, setBase] = useState(session.savedBase || '');
  const [token, setToken] = useState('');
  const [employeeId, setEmployeeId] = useState(session.savedEmployee ? String(session.savedEmployee) : '');
  const [showToken, setShowToken] = useState(false);
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErr, setFieldErr] = useState({});

  useEffect(() => {
    document.title = `${t('Đăng nhập')} | Linko`;
  }, [t]);

  const done = () => navigate(session.takeReturnTo() || '/', { replace: true });

  const wrap = async (fn) => {
    setBusy(true);
    setError(null);
    session.clearNotice();
    const timer = setTimeout(() => setSlow(true), 1500);
    try {
      await fn();
      done();
    } catch (err) {
      setError(describeError(err, t));
    } finally {
      clearTimeout(timer);
      setBusy(false);
      setSlow(false);
    }
  };

  const submitApi = (e) => {
    e.preventDefault();
    const next = {};
    const local = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(base.trim());
    if (base.trim() && !/^https:\/\//i.test(base.trim()) && !local) next.base = t('Địa chỉ API phải bắt đầu bằng https:// (trình duyệt chặn http trên trang Vercel).');
    if (!token.trim()) next.token = t('Dán access token do nhóm backend cấp.');
    setFieldErr(next);
    if (Object.keys(next).length) return;
    wrap(() => session.loginWithToken({ base, token, employeeId }));
  };

  const notice = session.notice === 'expired' ? t('Phiên đăng nhập đã hết hạn. Đăng nhập lại để tiếp tục.') : session.notice === 'idle' ? t('Bạn đã được đăng xuất sau 15 phút không hoạt động để bảo vệ dữ liệu.') : null;

  return (
    <div className="login">
      <div className="login-corner">
        <button type="button" className="link-btn" onClick={() => prefs.setLang(prefs.lang === 'vi' ? 'en' : 'vi')} aria-label={prefs.lang === 'vi' ? 'Switch to English' : 'Chuyển sang tiếng Việt'}>
          <Icon name="language" size={14} />
          {prefs.lang === 'vi' ? 'English' : 'Tiếng Việt'}
        </button>
        <IconButton icon={prefs.theme === 'dark' ? 'sun' : 'moon'} label={prefs.theme === 'dark' ? t('Giao diện sáng') : t('Giao diện tối')} size="sm" onClick={() => prefs.setTheme(prefs.theme === 'dark' ? 'light' : 'dark')} />
      </div>
      <BrandPanel />
      <main className="login-main" id="main">
        <div className="login-card">
          <h2 className="t-h2">{t('Đăng nhập vào Linko')}</h2>
          <p className="muted">{t('Chọn cách bạn muốn vào hệ thống.')}</p>
          {notice && <Banner tone="warning" icon="hourglass">{notice}</Banner>}
          <div className="login-switch" role="tablist" aria-label={t('Cách đăng nhập')}>
            <button type="button" role="tab" aria-selected={mode === 'demo'} className={mode === 'demo' ? 'is-on' : ''} onClick={() => setMode('demo')}>
              <Icon name="circle-play" size={14} filled={mode === 'demo'} />
              {t('Bản demo')}
            </button>
            <button type="button" role="tab" aria-selected={mode === 'api'} className={mode === 'api' ? 'is-on' : ''} onClick={() => setMode('api')}>
              <Icon name="database" size={14} filled={mode === 'api'} />
              {t('Kết nối API thật')}
            </button>
          </div>

          {error && (
            <Banner tone="danger" title={error.title}>
              {error.message}
            </Banner>
          )}

          {mode === 'demo' ? (
            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                wrap(() => session.loginDemo(persona));
              }}
            >
              <fieldset className="personas">
                <legend className="field-label">{t('Xem với vai trò')}</legend>
                {DEMO_PERSONAS.map((p) => {
                  const info = PERSONA_INFO[p.key];
                  return (
                    <label key={p.key} className={`radio-card persona${persona === p.key ? ' is-on' : ''}`}>
                      <input type="radio" name="persona" value={p.key} checked={persona === p.key} onChange={() => setPersona(p.key)} />
                      <Avatar name={info.name} size="md" presence={false} decorative />
                      <span className="persona-text">
                        <span className="persona-top">
                          <span className="t-label">{info.name}</span>
                          <span className="persona-role">{t(info.role)}</span>
                        </span>
                        <span className="muted t-caption">{info.title}</span>
                        <span className="t-caption persona-can">{t(info.can)}</span>
                      </span>
                    </label>
                  );
                })}
              </fieldset>
              <Button type="submit" variant="primary" size="lg" block state={busy ? 'loading' : undefined}>
                {t('Vào bản demo')}
              </Button>
              <p className="muted t-caption">{t('Bản demo chạy hoàn toàn trên trình duyệt với dữ liệu mẫu 117 nhân viên, cùng hợp đồng API và luật phân quyền của backend V7.')}</p>
            </form>
          ) : (
            <form className="form-stack" onSubmit={submitApi} noValidate>
              <TextField label={t('Địa chỉ API')} placeholder="https://api.linko.example" value={base} onChange={(e) => setBase(e.target.value)} error={fieldErr.base} hint={!fieldErr.base ? t('Để trống nếu frontend và API chung tên miền.') : undefined} inputMode="url" autoComplete="url" />
              <div className="field">
                <label className="field-label" htmlFor="token">
                  {t('Access token')} <span className="req" aria-hidden="true">*</span>
                </label>
                <div className="input-wrap has-action">
                  <input id="token" className="input t-mono-sm" type={showToken ? 'text' : 'password'} value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" spellCheck="false" aria-invalid={fieldErr.token ? true : undefined} placeholder="eyJhbGciOi..." />
                  <button type="button" className="input-action" onClick={() => setShowToken((s) => !s)} aria-label={showToken ? t('Ẩn token') : t('Hiện token')}>
                    <Icon name={showToken ? 'eye-slash' : 'eye'} size={14} />
                  </button>
                </div>
                {fieldErr.token ? (
                  <p className="field-error">
                    <Icon name="circle-exclamation" size={12} filled />
                    {fieldErr.token}
                  </p>
                ) : (
                  <p className="field-hint">{t('Token chỉ giữ trong bộ nhớ của tab này, không lưu vào trình duyệt.')}</p>
                )}
              </div>
              <TextField label={t('Mã nhân viên của bạn (không bắt buộc)')} inputMode="numeric" value={employeeId} onChange={(e) => setEmployeeId(e.target.value.replace(/\D/g, ''))} hint={t('Dùng để mở hồ sơ, kết nối và bảng tin của bạn.')} />
              <Button type="submit" variant="primary" size="lg" block state={busy ? 'loading' : undefined}>
                {t('Đăng nhập')}
              </Button>
              <details className="login-help">
                <summary>{t('Lấy token ở đâu?')}</summary>
                <p>{t('Backend không có trang đăng nhập công khai. Nhóm backend cấp token demo bằng lệnh:')}</p>
                <pre className="code">python tools/issue_demo_token.py --sub vinh.ngo --role employee</pre>
                <p>{t('Môi trường thật dùng OIDC. Nhớ thêm tên miền Vercel vào CORS_ORIGINS của backend.')}</p>
              </details>
            </form>
          )}
          <LoadingNote slow={slow} lines={['Đang mở kết nối tới Oracle 23ai...', 'Lần đầu khởi động pool kết nối hơi lâu, chờ chút nhé.', 'Vẫn đang kết nối. Kiểm tra lại địa chỉ API nếu chờ quá lâu.']} />
        </div>
      </main>
    </div>
  );
}
