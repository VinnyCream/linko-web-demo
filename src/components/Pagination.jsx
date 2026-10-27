import Icon from './Icon.jsx';
import { useT, usePrefs } from '../state/prefs.jsx';
import { formatNumber } from '../lib/format.js';

function pages(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) out.push('…');
  for (let i = start; i <= end; i += 1) out.push(i);
  if (end < total - 1) out.push('…');
  out.push(total);
  return out;
}

export function usePaged(rows, page, size) {
  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const safe = Math.min(Math.max(1, page), pageCount);
  return { slice: rows.slice((safe - 1) * size, safe * size), pageCount, page: safe, total };
}

// Phân trang: số trang có dấu ba chấm, chọn số dòng, câu "Hiển thị 1-20 trong 117".
export default function Pagination({ page, pageCount, total, size, onPage, onSize, sizes = [10, 20, 50], label }) {
  const t = useT();
  const { lang } = usePrefs();
  if (!total) return null;
  const from = (page - 1) * size + 1;
  const to = Math.min(total, page * size);
  return (
    <nav className="pager" aria-label={label || t('Phân trang')}>
      <p className="pager-info">
        {t('Hiển thị {from}-{to} trong {total}', { from: formatNumber(from, lang), to: formatNumber(to, lang), total: formatNumber(total, lang) })}
      </p>
      <div className="pager-pages">
        <button type="button" className="pager-btn" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label={t('Trang trước')}>
          <Icon name="chevron-left" size={12} />
        </button>
        {pages(page, pageCount).map((p, i) =>
          p === '…' ? (
            <span key={`e${i}`} className="pager-gap" aria-hidden="true">…</span>
          ) : (
            <button
              key={p}
              type="button"
              className={`pager-btn${p === page ? ' is-on' : ''}`}
              aria-current={p === page ? 'page' : undefined}
              aria-label={t('Trang {n}', { n: p })}
              onClick={() => onPage(p)}
            >
              {p}
            </button>
          ),
        )}
        <button type="button" className="pager-btn" onClick={() => onPage(page + 1)} disabled={page >= pageCount} aria-label={t('Trang sau')}>
          <Icon name="chevron-right" size={12} />
        </button>
      </div>
      {onSize && (
        <label className="pager-size">
          <span>{t('Mỗi trang')}</span>
          <select className="input select select-sm" value={size} onChange={(e) => onSize(Number(e.target.value))}>
            {sizes.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      )}
    </nav>
  );
}
