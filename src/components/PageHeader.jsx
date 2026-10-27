import { useEffect } from 'react';
import Icon from './Icon.jsx';
import { Link } from '../lib/router.jsx';
import { useT } from '../state/prefs.jsx';

// Breadcrumb: mục cuối là trang hiện tại (aria-current). Trên điện thoại chỉ còn mục cha gần nhất.
export function Breadcrumbs({ items }) {
  const t = useT();
  if (!items?.length) return null;
  return (
    <nav className="crumbs" aria-label={t('Đường dẫn trang')}>
      <ol>
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className={last ? 'is-current' : i === items.length - 2 ? 'is-parent' : ''}>
              {last || !item.to ? (
                <span aria-current={last ? 'page' : undefined} className="truncate">{item.label}</span>
              ) : (
                <Link to={item.to} className="truncate">
                  {i === items.length - 2 && <Icon name="chevron-left" size={10} className="crumb-back" />}
                  {item.label}
                </Link>
              )}
              {!last && <Icon name="chevron-right" size={10} className="crumb-sep" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default function PageHeader({ title, description, crumbs, actions, meta, children, titleHidden = false }) {
  const t = useT();
  useEffect(() => {
    document.title = title ? `${title} | Linko` : 'Linko';
  }, [title]);
  return (
    <header className="page-head">
      <Breadcrumbs items={crumbs ? [{ label: t('Trang chủ'), to: '/' }, ...crumbs] : null} />
      <div className={`page-head-row${titleHidden ? ' sr-only' : ''}`}>
        <div className="page-head-text">
          <h1 className="t-h1 page-title">{title}</h1>
          {description && <p className="page-desc">{description}</p>}
          {meta && <div className="page-meta">{meta}</div>}
        </div>
        {actions && <div className="page-actions">{actions}</div>}
      </div>
      {children}
    </header>
  );
}
