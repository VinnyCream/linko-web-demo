import { useEffect, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import Avatar from '../components/Avatar.jsx';
import { Button, IconButton } from '../components/Button.jsx';
import Menu from '../components/Menu.jsx';
import { SegmentedControl } from '../components/Form.jsx';
import { RoleBadge } from '../components/Badge.jsx';
import GlobalSearch from './GlobalSearch.jsx';
import { NotificationRow } from '../pages/Notifications.jsx';
import { Link, useNavigate } from '../lib/router.jsx';
import { usePrefs, useT } from '../state/prefs.jsx';
import { useSession } from '../auth/session.jsx';
import { useSocial } from '../state/social.jsx';

// Thanh trên: ô tìm kiếm nằm chính giữa. Ngôn ngữ và giao diện nằm trong menu tài khoản,
// không chiếm chỗ trên thanh. Điện thoại: nút menu, linh vật, nút tìm, thông báo, tài khoản.
export default function TopBar({ onMenu, onCompose }) {
  const t = useT();
  const prefs = usePrefs();
  const session = useSession();
  const social = useSocial();
  const navigate = useNavigate();
  const [mobileSearch, setMobileSearch] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);
  const me = session.me;
  const name = me?.full_name || session.subject || t('Tài khoản');

  const onAction = (kind) => {
    if (kind === 'compose') onCompose();
    if (kind === 'theme') prefs.setTheme(prefs.theme === 'dark' ? 'light' : 'dark');
    if (kind === 'lang') prefs.setLang(prefs.lang === 'vi' ? 'en' : 'vi');
    if (kind === 'logout') session.logout();
  };

  useEffect(() => {
    if (!notifOpen) return undefined;
    const onDoc = (e) => !notifRef.current?.contains(e.target) && setNotifOpen(false);
    const onKey = (e) => e.key === 'Escape' && setNotifOpen(false);
    document.addEventListener('pointerdown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [notifOpen]);

  const latest = social.notifications.slice(0, 5);

  return (
    <header className="topbar">
      <div className="topbar-left">
        <IconButton icon="bars" label={t('Mở menu')} className="only-mobile" onClick={onMenu} tooltip={false} />
        <Link to="/" className="topbar-mark only-mobile" aria-label={t('Linko, về Bảng tin')}>
          <img src="/brand/linko-mark.png" alt="" width="42" height="40" />
        </Link>
      </div>

      <div className="topbar-center">
        <GlobalSearch onAction={onAction} />
      </div>

      <div className="topbar-right">
        <IconButton icon="magnifying-glass" label={t('Tìm kiếm')} className="only-mobile" onClick={() => setMobileSearch(true)} tooltip={false} />
        <Button variant="primary" iconStart="pen-to-square" className="compose-btn" onClick={onCompose}>
          {t('Tạo bài viết')}
        </Button>
        <IconButton icon="pen-to-square" label={t('Tạo bài viết')} variant="soft" className="compose-ibtn" onClick={onCompose} />
        <IconButton icon="comments" label={t('Tin nhắn')} badge={social.unreadMessages} className="hide-mobile" onClick={() => navigate('/messages')} />
        <div className="pop-wrap" ref={notifRef}>
          <IconButton
            icon="bell"
            label={social.unreadNotifications ? t('Thông báo, {n} chưa đọc', { n: social.unreadNotifications }) : t('Thông báo')}
            badge={social.unreadNotifications}
            ping={social.pingKey}
            anim={social.pingKey ? 'shake' : undefined}
            animKey={social.pingKey}
            className={notifOpen ? 'is-pressed' : ''}
            onClick={() => setNotifOpen((o) => !o)}
            aria-haspopup="dialog"
            aria-expanded={notifOpen}
          />
          {notifOpen && (
            <div className="popover notif-pop" role="dialog" aria-label={t('Thông báo mới')}>
              <div className="popover-head">
                <h2 className="t-h4">{t('Thông báo')}</h2>
                {social.unreadNotifications > 0 && (
                  <button type="button" className="link-btn" onClick={social.markAllRead}>
                    {t('Đánh dấu đã đọc')}
                  </button>
                )}
              </div>
              {latest.length === 0 ? (
                <p className="popover-empty">{t('Bạn đã xem hết thông báo.')}</p>
              ) : (
                <ul className="notif-list compact">
                  {latest.map((n) => (
                    <NotificationRow key={n.id} n={n} compact onOpen={() => setNotifOpen(false)} />
                  ))}
                </ul>
              )}
              <Link to="/notifications" className="popover-foot" onClick={() => setNotifOpen(false)}>
                {t('Xem tất cả thông báo')}
              </Link>
            </div>
          )}
        </div>
        <Menu
          label={t('Tài khoản')}
          width={300}
          trigger={(props) => (
            <button type="button" className="account-btn" aria-label={t('Tài khoản của {name}', { name })} {...props}>
              <Avatar id={me?.employee_id} name={name} size="sm" decorative />
              <Icon name="chevron-down" size={10} className="hide-mobile" />
            </button>
          )}
          items={[
            {
              id: 'who',
              render: () => (
                <div className="account-head">
                  <Avatar id={me?.employee_id} name={name} size="md" />
                  <div className="account-meta">
                    <p className="t-label truncate">{name}</p>
                    <p className="muted t-caption truncate">{me?.title || session.subject}</p>
                    <RoleBadge role={session.role} />
                  </div>
                </div>
              ),
            },
            { divider: true },
            me && { id: 'profile', label: t('Hồ sơ của tôi'), icon: 'circle-user', onSelect: () => navigate(`/people/${me.employee_id}`) },
            { divider: true },
            {
              id: 'theme',
              render: () => (
                <div className="menu-setting">
                  <span className="menu-setting-label">{t('Giao diện')}</span>
                  <SegmentedControl
                    size="sm"
                    label={t('Giao diện')}
                    value={prefs.themePref}
                    onChange={prefs.setTheme}
                    options={[
                      { value: 'light', label: t('Sáng'), icon: 'sun', iconOnly: true },
                      { value: 'dark', label: t('Tối'), icon: 'moon', iconOnly: true },
                      { value: 'system', label: t('Theo hệ thống'), icon: 'sliders', iconOnly: true },
                    ]}
                  />
                </div>
              ),
            },
            {
              id: 'lang',
              render: () => (
                <div className="menu-setting">
                  <span className="menu-setting-label">{t('Ngôn ngữ')}</span>
                  <SegmentedControl
                    size="sm"
                    label={t('Ngôn ngữ')}
                    value={prefs.lang}
                    onChange={prefs.setLang}
                    options={[
                      { value: 'vi', label: 'Tiếng Việt' },
                      { value: 'en', label: 'English' },
                    ]}
                  />
                </div>
              ),
            },
            { divider: true },
            { id: 'settings', label: t('Cài đặt'), icon: 'gear', onSelect: () => navigate('/settings') },
            { id: 'help', label: t('Phím tắt và trợ giúp'), icon: 'circle-question', hint: '?', onSelect: () => navigate('/help') },
            { divider: true },
            { id: 'logout', label: t('Đăng xuất'), icon: 'arrow-right-from-bracket', tone: 'danger', onSelect: () => session.logout() },
          ]}
        />
      </div>

      {mobileSearch && (
        <div className="msearch" role="dialog" aria-modal="true" aria-label={t('Tìm kiếm')}>
          <div className="msearch-bar">
            <GlobalSearch variant="overlay" autoFocus onAction={onAction} onDone={() => setMobileSearch(false)} />
            <Button variant="ghost" onClick={() => setMobileSearch(false)}>
              {t('Huỷ')}
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
