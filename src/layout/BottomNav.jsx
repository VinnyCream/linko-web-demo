import Icon from '../components/Icon.jsx';
import { Link } from '../lib/router.jsx';
import { allNavItems, NAV_MOBILE } from './nav.js';
import { useT } from '../state/prefs.jsx';
import { useSocial } from '../state/social.jsx';

// Thanh dưới trên điện thoại: 4 mục chính + "Thêm" mở ngăn kéo điều hướng đầy đủ. Có tính vùng an toàn.
export default function BottomNav({ activeId, onMore }) {
  const t = useT();
  const social = useSocial();
  const items = allNavItems().filter((i) => NAV_MOBILE.includes(i.id));
  const ordered = NAV_MOBILE.map((id) => items.find((i) => i.id === id)).filter(Boolean);
  const inMore = !NAV_MOBILE.includes(activeId);
  return (
    <nav className="bottomnav" aria-label={t('Điều hướng nhanh')}>
      {ordered.map((item) => {
        const active = item.id === activeId;
        const badge = item.id === 'notifications' ? social.unreadNotifications : 0;
        return (
          <Link key={item.id} to={item.path} className={`bn-item${active ? ' is-active' : ''}`} aria-current={active ? 'page' : undefined}>
            <span className="bn-icon">
              <Icon name={item.icon} filled={active} size={20} />
              {badge > 0 && <span className="count-badge bn-badge">{badge > 9 ? '9+' : badge}</span>}
            </span>
            <span className="bn-label">{t(item.label === 'Kết nối của tôi' ? 'Kết nối' : item.label)}</span>
          </Link>
        );
      })}
      <button type="button" className={`bn-item${inMore ? ' is-active' : ''}`} onClick={onMore} aria-label={t('Thêm mục điều hướng')}>
        <span className="bn-icon">
          <Icon name="ellipsis" size={20} />
        </span>
        <span className="bn-label">{t('Thêm')}</span>
      </button>
    </nav>
  );
}
