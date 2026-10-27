import { useEffect } from 'react';
import Icon from '../components/Icon.jsx';
import Tooltip from '../components/Tooltip.jsx';
import { Link } from '../lib/router.jsx';
import { NAV, NAV_FOOT } from './nav.js';
import { hasRole } from '../auth/permissions.js';
import { usePrefs, useT } from '../state/prefs.jsx';
import { useSession } from '../auth/session.jsx';
import { useSocial } from '../state/social.jsx';

// Thanh bên. Cột biểu tượng cố định (tâm cách mép trái 36px ở cả hai trạng thái), nên khi thu gọn
// biểu tượng và linh vật trong logo đứng yên, chỉ chữ mờ đi. Logo luôn cao 32px.
export default function Sidebar({ activeId, mobileOpen, onMobileClose }) {
  const t = useT();
  const { collapsed, setCollapsed } = usePrefs();
  const { role } = useSession();
  const social = useSocial();
  const counts = { messages: social.unreadMessages, notifications: social.unreadNotifications };
  const isCollapsed = collapsed && !mobileOpen;

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && onMobileClose();
    document.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
    };
  }, [mobileOpen, onMobileClose]);

  const renderItem = (item) => {
    const active = item.id === activeId;
    const badge = item.badge ? counts[item.badge] : 0;
    const link = (
      <Link
        to={item.path}
        className={`nav-item${active ? ' is-active' : ''}`}
        aria-current={active ? 'page' : undefined}
        onClick={onMobileClose}
        aria-label={isCollapsed ? (badge ? `${t(item.label)}, ${badge} ${t('chưa đọc')}` : t(item.label)) : undefined}
      >
        <span className="nav-icon">
          <Icon name={item.icon} filled={active} size={18} />
          {badge > 0 && isCollapsed && <span className="nav-dot" aria-hidden="true" />}
        </span>
        <span className="nav-label">{t(item.label)}</span>
        {badge > 0 && !isCollapsed && <span className="count-badge nav-count">{badge > 99 ? '99+' : badge}</span>}
      </Link>
    );
    return (
      <li key={item.id}>
        {isCollapsed ? (
          <Tooltip content={t(item.label)} placement="right">
            {link}
          </Tooltip>
        ) : (
          link
        )}
      </li>
    );
  };

  return (
    <>
      {mobileOpen && <div className="scrim drawer-scrim" onClick={onMobileClose} aria-hidden="true" />}
      <aside className={`sidebar${isCollapsed ? ' is-collapsed' : ''}${mobileOpen ? ' is-open' : ''}`} aria-label={t('Điều hướng chính')}>
        <div className="sidebar-head">
          <Link to="/" className="brand" aria-label={t('Linko, về Bảng tin')} onClick={onMobileClose}>
            <span className="brand-clip">
              <img src="/brand/linko-logo.png" alt="" className="brand-logo" width="107" height="40" />
            </span>
          </Link>
          <button
            type="button"
            className="collapse-btn"
            onClick={() => (mobileOpen ? onMobileClose() : setCollapsed((c) => !c))}
            aria-label={mobileOpen ? t('Đóng menu') : collapsed ? t('Mở rộng thanh bên (Ctrl B)') : t('Thu gọn thanh bên (Ctrl B)')}
            title={mobileOpen ? undefined : collapsed ? t('Mở rộng (Ctrl B)') : t('Thu gọn (Ctrl B)')}
          >
            <Icon name={mobileOpen ? 'xmark' : isCollapsed ? 'angles-right' : 'angles-left'} size={12} />
          </button>
        </div>
        <nav className="sidebar-scroll">
          {NAV.filter((g) => hasRole(role, g.role || 'employee')).map((group) => (
            <section key={group.id} className="nav-group" aria-labelledby={`nav-${group.id}`}>
              <h2 id={`nav-${group.id}`} className="nav-group-title">
                <span>{t(group.label)}</span>
              </h2>
              <ul>{group.items.filter((i) => hasRole(role, i.role || 'employee')).map(renderItem)}</ul>
            </section>
          ))}
        </nav>
        <div className="sidebar-foot">
          <ul>{NAV_FOOT.map(renderItem)}</ul>
        </div>
      </aside>
    </>
  );
}
