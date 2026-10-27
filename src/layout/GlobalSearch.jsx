import { useEffect, useId, useMemo, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import Avatar from '../components/Avatar.jsx';
import { useNavigate } from '../lib/router.jsx';
import { fold } from '../lib/format.js';
import { usePeople } from '../state/people.jsx';
import { usePrefs, useT } from '../state/prefs.jsx';
import { useSession } from '../auth/session.jsx';
import { hasRole } from '../auth/permissions.js';
import { allNavItems } from './nav.js';
import { readStore, writeStore } from '../lib/storage.js';

// Tìm kiếm toàn cục giữa thanh trên: tính năng, thao tác nhanh, đồng nghiệp, phòng ban, dự án.
// Tìm không dấu ("ke toan" ra "Kế toán"), có từ đồng nghĩa, phím tắt Ctrl K hoặc "/".
const SYNONYMS = {
  'nhan su': ['hr', 'nhân sự'],
  hr: ['nhan su'],
  'ke toan': ['tai chinh', 'accountant'],
  'tai chinh': ['ke toan', 'finance', 'cfo'],
  dev: ['developer', 'lap trinh'],
  'lap trinh': ['developer', 'dev'],
  sep: ['quan ly', 'manager', 'giam doc'],
  'quan ly': ['manager', 'lead', 'giam doc'],
  'chi nhanh': ['ha noi', 'da nang', 'can tho'],
  sale: ['kinh doanh', 'sales'],
  'kinh doanh': ['sales', 'sale'],
  'giao dien': ['theme', 'dark mode', 'light mode'],
  'dark mode': ['giao dien toi'],
  'ngon ngu': ['english', 'tieng anh', 'language'],
  'mat khau': ['dang xuat'],
};

function matches(haystack, needle) {
  const h = fold(haystack);
  if (h.includes(needle)) return 2;
  const alts = SYNONYMS[needle] || [];
  if (alts.some((a) => h.includes(fold(a)))) return 1;
  const words = needle.split(/\s+/).filter(Boolean);
  if (words.length > 1 && words.every((w) => h.includes(w))) return 1;
  return 0;
}

export default function GlobalSearch({ onAction, autoFocus = false, onDone, variant = 'bar' }) {
  const t = useT();
  const { lang } = usePrefs();
  const navigate = useNavigate();
  const { people, departments, projects } = usePeople();
  const { role, me } = useSession();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(autoFocus);
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState(() => readStore('recent-search', []));
  const inputRef = useRef(null);
  const wrapRef = useRef(null);
  const listId = useId();

  useEffect(() => {
    if (variant !== 'bar') return undefined;
    const onKey = (e) => {
      const tag = document.activeElement?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable;
      if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing)) {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [variant]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDoc);
    return () => document.removeEventListener('pointerdown', onDoc);
  }, [open]);

  const quickActions = useMemo(
    () => [
      { id: 'a-post', label: t('Tạo bài viết'), icon: 'pen-to-square', keywords: 'dang bai viet post', run: () => onAction?.('compose') },
      { id: 'a-path', label: t('Tìm đường kết nối tới một người'), icon: 'route', keywords: 'duong di shortest path', run: () => navigate('/path') },
      { id: 'a-theme', label: t('Đổi giao diện sáng hoặc tối'), icon: 'moon', keywords: 'giao dien dark light theme che do toi sang', run: () => onAction?.('theme') },
      { id: 'a-lang', label: lang === 'vi' ? 'Switch to English' : 'Chuyển sang tiếng Việt', icon: 'language', keywords: 'ngon ngu language english tieng viet', run: () => onAction?.('lang') },
      { id: 'a-avatar', label: t('Đổi ảnh đại diện'), icon: 'image', keywords: 'anh dai dien avatar', run: () => navigate(me ? `/people/${me.employee_id}?photo=1` : '/settings') },
      { id: 'a-shortcut', label: t('Xem phím tắt'), icon: 'circle-question', keywords: 'phim tat shortcut', run: () => navigate('/help#shortcuts') },
      { id: 'a-logout', label: t('Đăng xuất'), icon: 'arrow-right-from-bracket', keywords: 'dang xuat logout thoat', run: () => onAction?.('logout') },
    ],
    [t, lang, navigate, onAction, me],
  );

  const groups = useMemo(() => {
    const needle = fold(q);
    if (!needle) return [];
    const features = allNavItems()
      .filter((i) => hasRole(role, i.role || 'employee'))
      .map((i) => ({ ...i, score: matches(`${t(i.label)} ${i.label} ${i.id}`, needle) }))
      .filter((i) => i.score)
      .slice(0, 5)
      .map((i) => ({ key: `f-${i.id}`, type: 'feature', icon: i.icon, title: t(i.label), sub: t(i.group), run: () => navigate(i.path) }));
    const actions = quickActions
      .map((a) => ({ ...a, score: matches(`${a.label} ${a.keywords}`, needle) }))
      .filter((a) => a.score)
      .slice(0, 3)
      .map((a) => ({ key: a.id, type: 'action', icon: a.icon, title: a.label, sub: t('Thao tác nhanh'), run: a.run }));
    const persons = people
      .map((p) => ({ p, score: matches(`${p.full_name} ${p.title || ''} ${p.department_name || ''} ${p.email || ''}`, needle) + (fold(p.full_name).startsWith(needle) ? 2 : 0) }))
      .filter((x) => x.score)
      .sort((a, b) => b.score - a.score || (a.p.status === 'ACTIVE' ? -1 : 1))
      .slice(0, 6)
      .map(({ p }) => ({ key: `p-${p.employee_id}`, type: 'person', person: p, title: p.full_name, sub: [p.title, p.department_name].filter(Boolean).join(', '), run: () => navigate(`/people/${p.employee_id}`) }));
    const depts = departments
      .filter((d) => matches(`${d.department_name} ${d.location || ''}`, needle))
      .slice(0, 3)
      .map((d) => ({ key: `d-${d.department_id}`, type: 'dept', icon: 'building', title: d.department_name, sub: t('{n} nhân viên', { n: d.employee_count }), run: () => navigate(`/departments/${d.department_id}`) }));
    const projs = projects
      .filter((p) => matches(`${p.project_name} ${p.description || ''}`, needle))
      .slice(0, 3)
      .map((p) => ({ key: `j-${p.project_id}`, type: 'project', icon: 'folder', title: p.project_name, sub: t('{n} thành viên', { n: p.member_count }), run: () => navigate(`/projects/${p.project_id}`) }));
    return [
      { id: 'people', label: t('Đồng nghiệp'), items: persons },
      { id: 'features', label: t('Tính năng'), items: [...features, ...actions] },
      { id: 'depts', label: t('Phòng ban'), items: depts },
      { id: 'projects', label: t('Dự án'), items: projs },
    ].filter((g) => g.items.length);
  }, [q, people, departments, projects, role, t, navigate, quickActions]);

  const flat = groups.flatMap((g) => g.items);
  const recentItems = !q ? recent.map((r) => ({ key: `r-${r.title}`, type: 'recent', icon: 'clock', title: r.title, sub: t('Tìm gần đây'), run: () => (r.path ? navigate(r.path) : setQ(r.title)) })) : [];
  const suggestions = !q
    ? [
        { key: 's-path', type: 'action', icon: 'compass', title: t('Tìm đường kết nối'), sub: t('Gợi ý'), run: () => navigate('/path') },
        { key: 's-dir', type: 'action', icon: 'address-book', title: t('Mở danh bạ'), sub: t('Gợi ý'), run: () => navigate('/directory') },
      ]
    : [];
  const list = q ? flat : [...recentItems, ...suggestions];

  const choose = (item) => {
    if (!item) return;
    if (item.type !== 'recent' && q) {
      const entry = { title: item.title, path: item.type === 'person' ? `/people/${item.person.employee_id}` : undefined };
      const next = [entry, ...recent.filter((r) => r.title !== entry.title)].slice(0, 5);
      setRecent(next);
      writeStore('recent-search', next);
    }
    item.run();
    setQ('');
    setOpen(false);
    inputRef.current?.blur();
    onDone?.();
  };

  const onKey = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, list.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(list[active]);
    } else if (e.key === 'Escape') {
      if (q) setQ('');
      else {
        setOpen(false);
        inputRef.current?.blur();
        onDone?.();
      }
    }
  };

  let flatIndex = -1;
  const renderItem = (item) => {
    flatIndex += 1;
    const i = flatIndex;
    return (
      <li
        key={item.key}
        id={`${listId}-${i}`}
        role="option"
        aria-selected={i === active}
        className={`gs-item${i === active ? ' is-active' : ''}`}
        onMouseDown={(e) => e.preventDefault()}
        onMouseEnter={() => setActive(i)}
        onClick={() => choose(item)}
      >
        {item.type === 'person' ? (
          <Avatar id={item.person.employee_id} name={item.person.full_name} size="sm" />
        ) : (
          <span className="gs-icon" aria-hidden="true">
            <Icon name={item.icon} size={16} />
          </span>
        )}
        <span className="gs-text">
          <span className="gs-title truncate">{item.title}</span>
          {item.sub && <span className="gs-sub truncate">{item.sub}</span>}
        </span>
        {i === active && <Icon name="arrow-right" size={12} className="gs-enter" />}
      </li>
    );
  };

  return (
    <div className={`gsearch gsearch-${variant}${open ? ' is-open' : ''}`} ref={wrapRef}>
      <div className="gs-field">
        <Icon name="magnifying-glass" size={16} className="gs-lens" />
        <input
          ref={inputRef}
          type="search"
          className="gs-input"
          placeholder={t('Tìm người, phòng ban, dự án, tính năng')}
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          role="combobox"
          aria-label={t('Tìm kiếm trong Linko')}
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && list[active] ? `${listId}-${active}` : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          spellCheck="false"
        />
        {variant === 'bar' && !q && <kbd className="gs-kbd">Ctrl K</kbd>}
      </div>
      {open && (
        <div className="gs-pop" role="presentation">
          <ul id={listId} role="listbox" aria-label={t('Kết quả tìm kiếm')} className="gs-list">
            {q && groups.length === 0 && (
              <li className="gs-empty" role="presentation">
                <p className="t-label">{t('Không tìm thấy “{q}”', { q })}</p>
                <p className="muted t-caption">{t('Thử tên không dấu, chức danh như "Tech Lead" hoặc tên phòng ban như Phòng Tài chính.')}</p>
              </li>
            )}
            {q
              ? groups.map((g) => (
                  <li key={g.id} role="presentation" className="gs-group">
                    <p className="gs-group-title">{g.label}</p>
                    <ul role="presentation">{g.items.map(renderItem)}</ul>
                  </li>
                ))
              : list.length > 0 && (
                  <li role="presentation" className="gs-group">
                    <p className="gs-group-title">{recentItems.length ? t('Gần đây và gợi ý') : t('Gợi ý')}</p>
                    <ul role="presentation">{list.map(renderItem)}</ul>
                  </li>
                )}
          </ul>
          <p className="gs-foot" aria-hidden="true">
            <span><kbd>↑</kbd><kbd>↓</kbd> {t('chọn')}</span>
            <span><kbd>Enter</kbd> {t('mở')}</span>
            <span><kbd>Esc</kbd> {t('đóng')}</span>
          </p>
        </div>
      )}
    </div>
  );
}
