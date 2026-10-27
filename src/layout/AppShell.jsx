import { useCallback, useEffect, useRef, useState } from 'react';
import Sidebar from './Sidebar.jsx';
import TopBar from './TopBar.jsx';
import BottomNav from './BottomNav.jsx';
import ComposeDialog from './ComposeDialog.jsx';
import { activeNavId } from './nav.js';
import { Banner } from '../components/Feedback.jsx';
import { useLocation, useNavigate } from '../lib/router.jsx';
import { usePrefs, useT } from '../state/prefs.jsx';
import { useSession } from '../auth/session.jsx';
import { usePeople } from '../state/people.jsx';
import { on } from '../api/client.js';
import { api } from '../api/endpoints.js';
import { invalidate } from '../hooks/useQuery.js';
import { describeError } from '../lib/errors.js';

// Thanh tiến trình mảnh trên cùng khi có request đang chạy (chỉ hiện nếu quá 250ms).
function TopProgress() {
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let timer;
    return on('inflight', (n) => {
      clearTimeout(timer);
      if (n > 0) timer = setTimeout(() => setBusy(true), 250);
      else setBusy(false);
    });
  }, []);
  return <div className={`top-progress${busy ? ' is-busy' : ''}`} aria-hidden="true" />;
}

// Mất kết nối tới API/Oracle: banner đỏ, tự thử lại lùi dần 2, 4, 8 giây rồi chờ người dùng.
function ConnectionBanner() {
  const t = useT();
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const timer = useRef(null);

  useEffect(() => on('unavailable', (err) => setError((prev) => prev || err)), []);

  const retry = useCallback(async () => {
    try {
      await api.employees({ limit: 1, status: 'ALL' });
      setError(null);
      setAttempt(0);
      invalidate();
    } catch (err) {
      setError(err);
      setAttempt((a) => a + 1);
    }
  }, []);

  useEffect(() => {
    if (!error || attempt >= 3) return undefined;
    const wait = [2, 4, 8][attempt];
    setCountdown(wait);
    timer.current = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    const id = setTimeout(retry, wait * 1000);
    return () => {
      clearTimeout(id);
      clearInterval(timer.current);
    };
  }, [error, attempt, retry]);

  if (!error) return null;
  const info = describeError(error, t);
  return (
    <Banner tone="danger" title={info.title} action={t('Thử lại ngay')} onAction={retry} onClose={() => setError(null)} className="shell-banner">
      {info.message}{' '}
      {attempt < 3 && countdown > 0 ? t('Tự thử lại sau {s} giây.', { s: countdown }) : t('Đã thử 3 lần. Bấm Thử lại khi máy chủ đã chạy.')}
    </Banner>
  );
}

// Không hoạt động 15 phút: đếm ngược 2 phút rồi đăng xuất. Token sắp hết hạn: nhắc trước 2 phút.
function SessionGuard() {
  const t = useT();
  const session = useSession();
  const [warn, setWarn] = useState(null); // { reason, left }
  const last = useRef(Date.now());

  useEffect(() => {
    const touch = () => {
      last.current = Date.now();
    };
    const events = ['pointerdown', 'keydown', 'scroll'];
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const id = setInterval(() => {
      const idleMs = Date.now() - last.current;
      const IDLE = 15 * 60_000;
      const GRACE = 2 * 60_000;
      if (session.expiresAt && session.expiresAt - Date.now() < GRACE) {
        const left = Math.max(0, Math.round((session.expiresAt - Date.now()) / 1000));
        if (left === 0) session.logout('expired');
        else setWarn({ reason: 'token', left });
      } else if (idleMs > IDLE) {
        const left = Math.max(0, Math.round((IDLE + GRACE - idleMs) / 1000));
        if (left === 0) session.logout('idle');
        else setWarn({ reason: 'idle', left });
      } else setWarn(null);
    }, 1000);
    return () => {
      clearInterval(id);
      events.forEach((e) => window.removeEventListener(e, touch));
    };
  }, [session]);

  if (!warn) return null;
  const mm = String(Math.floor(warn.left / 60)).padStart(1, '0');
  const ss = String(warn.left % 60).padStart(2, '0');
  return (
    <Banner
      tone="warning"
      icon="hourglass"
      title={warn.reason === 'token' ? t('Phiên đăng nhập sắp hết hạn') : t('Bạn vẫn đang ở đây chứ?')}
      action={warn.reason === 'idle' ? t('Tiếp tục làm việc') : t('Đăng nhập lại')}
      onAction={() => (warn.reason === 'idle' ? setWarn(null) : session.logout('expired'))}
      className="shell-banner"
    >
      {t('Linko sẽ đăng xuất sau {time} để bảo vệ dữ liệu của bạn.', { time: `${mm}:${ss}` })}
    </Banner>
  );
}

function OfflineBanner() {
  const t = useT();
  const { online } = usePeople();
  if (online) return null;
  return (
    <Banner tone="warning" icon="plug-circle-xmark" title={t('Bạn đang ngoại tuyến')} className="shell-banner">
      {t('Kiểm tra Wi-Fi hoặc dây mạng. Dữ liệu đang hiển thị có thể chưa mới nhất.')}
    </Banner>
  );
}

export default function AppShell({ children }) {
  const t = useT();
  const { setCollapsed } = usePrefs();
  const session = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const [drawer, setDrawer] = useState(false);
  const [compose, setCompose] = useState(false);
  const mainRef = useRef(null);
  const activeId = activeNavId(location.pathname);
  const closeDrawer = useCallback(() => setDrawer(false), []);

  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if (e.key.toLowerCase() === 'b' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setCollapsed((c) => !c);
      }
      if (!typing && e.key === '?' && !e.ctrlKey && !e.metaKey) navigate('/help#shortcuts');
      if (!typing && e.key.toLowerCase() === 'n' && e.altKey) {
        e.preventDefault();
        setCompose(true);
      }
    };
    const onCompose = () => setCompose(true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('linko:compose', onCompose);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('linko:compose', onCompose);
    };
  }, [setCollapsed, navigate]);

  // Đổi trang: đưa focus về vùng nội dung để trình đọc màn hình đọc trang mới.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!location.hash) mainRef.current?.focus({ preventScroll: true });
  }, [location.pathname, location.hash]);

  return (
    <div className="shell">
      <a href="#main" className="skip-link">
        {t('Bỏ qua điều hướng')}
      </a>
      <TopProgress />
      <Sidebar activeId={activeId} mobileOpen={drawer} onMobileClose={closeDrawer} />
      <div className="shell-main">
        <TopBar onMenu={() => setDrawer(true)} onCompose={() => setCompose(true)} />
        {session.mode === 'demo' && (
          <p className="demo-strip" role="note">
            {t('Bạn đang xem bản demo với dữ liệu mẫu từ 02_sample_data.sql. Mọi thay đổi chỉ lưu trên trình duyệt này.')}
          </p>
        )}
        <div className="shell-banners">
          <OfflineBanner />
          <ConnectionBanner />
          <SessionGuard />
        </div>
        <main id="main" ref={mainRef} tabIndex={-1} className="content">
          {children}
        </main>
      </div>
      <BottomNav activeId={activeId} onMore={() => setDrawer(true)} />
      <ComposeDialog open={compose} onClose={() => setCompose(false)} />
    </div>
  );
}
