import { useEffect, useMemo, useRef, useState } from 'react';
import { usePrefs, useT } from '../state/prefs.jsx';
import { formatNumber } from '../lib/format.js';

// Biểu đồ dùng chung, vẽ bằng SVG/HTML thuần, màu lấy từ token --chart-* (đã kiểm tra mù màu
// bằng validator: mỗi cặp liền kề cách nhau ΔE >= 8). Màu đi theo thực thể, không theo thứ hạng.

function pct(v, total, lang) {
  return `${formatNumber(total ? (v / total) * 100 : 0, lang, 1)}%`;
}

function arc(cx, cy, r, a0, a1) {
  const p = (a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
}

/**
 * Donut cho phần trên tổng (tối đa 6 phần). rows: [{ key, label, value, slot }] theo thứ tự cố định.
 */
export function DonutChart({ rows, centerLabel, title }) {
  const t = useT();
  const { lang } = usePrefs();
  const [active, setActive] = useState(null);
  const total = rows.reduce((s, r) => s + r.value, 0);
  const segs = useMemo(() => {
    let a = -Math.PI / 2;
    return rows.filter((r) => r.value > 0).map((r) => {
      const sweep = (r.value / Math.max(1, total)) * Math.PI * 2;
      const seg = { ...r, a0: a, a1: a + sweep };
      a += sweep;
      return seg;
    });
  }, [rows, total]);
  const shown = active ? rows.find((r) => r.key === active) : null;
  return (
    <div className="donut">
      <div className="donut-figure">
        <svg viewBox="0 0 200 200" role="img" aria-label={`${title}: ${rows.map((r) => `${r.label} ${r.value}`).join(', ')}`}>
          <circle cx="100" cy="100" r="74" className="donut-track" />
          {segs.map((s) => {
            const full = s.a1 - s.a0 >= Math.PI * 2 - 0.001;
            const minSweep = Math.max(s.a1, s.a0 + 0.035);
            return (
              <path
                key={s.key}
                d={full ? arc(100, 100, 74, -Math.PI / 2, Math.PI * 1.5 - 0.0001) : arc(100, 100, 74, s.a0, minSweep)}
                className={`donut-seg chart-${s.slot}${active && active !== s.key ? ' is-dim' : ''}`}
                onPointerEnter={() => setActive(s.key)}
                onPointerLeave={() => setActive(null)}
              />
            );
          })}
          {/* Khe 2px màu nền giữa các phần */}
          {segs.length > 1 && segs.map((s) => (
            <line key={`gap-${s.key}`} x1={100 + 58 * Math.cos(s.a0)} y1={100 + 58 * Math.sin(s.a0)} x2={100 + 90 * Math.cos(s.a0)} y2={100 + 90 * Math.sin(s.a0)} className="donut-gap" />
          ))}
        </svg>
        <div className="donut-center" aria-hidden="true">
          <span className="donut-value lk-num">{formatNumber(shown ? shown.value : total, lang)}</span>
          <span className="donut-caption">{shown ? shown.label : centerLabel}</span>
          {shown && <span className="donut-pct lk-num">{pct(shown.value, total, lang)}</span>}
        </div>
      </div>
      <ul className="chart-legend">
        {rows.map((r) => (
          <li
            key={r.key}
            className={`legend-row${active === r.key ? ' is-on' : ''}${!r.value ? ' is-zero' : ''}`}
            onPointerEnter={() => setActive(r.key)}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive(r.key)}
            onBlur={() => setActive(null)}
            tabIndex={0}
          >
            <span className={`legend-dot chart-${r.slot}`} aria-hidden="true" />
            <span className="legend-label">{r.label}</span>
            <span className="legend-value lk-num">{formatNumber(r.value, lang)}</span>
            <span className="legend-pct lk-num">{pct(r.value, total, lang)}</span>
          </li>
        ))}
      </ul>
      <p className="sr-only">{t('Tổng {n}', { n: total })}</p>
    </div>
  );
}

/** Thanh 100% chia phần, 2px khe giữa các đoạn. rows: [{ key, label, value, slot }] */
export function StackedBar({ rows, label }) {
  const { lang } = usePrefs();
  const total = rows.reduce((s, r) => s + r.value, 0) || 1;
  return (
    <div className="stack">
      <div className="stack-bar" role="img" aria-label={`${label}: ${rows.map((r) => `${r.label} ${r.value}`).join(', ')}`}>
        {rows.filter((r) => r.value > 0).map((r) => (
          <span key={r.key} className={`stack-seg chart-${r.slot}`} style={{ '--w': `${(r.value / total) * 100}%` }} title={`${r.label}: ${formatNumber(r.value, lang)} (${pct(r.value, total, lang)})`} />
        ))}
      </div>
      <ul className="stack-legend">
        {rows.map((r) => (
          <li key={r.key}>
            <span className={`legend-dot chart-${r.slot}`} aria-hidden="true" />
            <span>{r.label}</span>
            <span className="lk-num muted">{formatNumber(r.value, lang)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Treemap nhị phân: chia danh sách thành hai nửa tổng gần bằng nhau, cắt theo cạnh dài hơn.
function layoutTreemap(items, x, y, w, h, out) {
  if (!items.length) return out;
  if (items.length === 1) {
    out.push({ ...items[0], x, y, w, h });
    return out;
  }
  const total = items.reduce((s, i) => s + i.value, 0);
  let acc = 0;
  let cut = 1;
  for (let i = 0; i < items.length - 1; i += 1) {
    acc += items[i].value;
    cut = i + 1;
    if (acc >= total / 2) break;
  }
  const a = items.slice(0, cut);
  const b = items.slice(cut);
  const ratio = a.reduce((s, i) => s + i.value, 0) / Math.max(1, total);
  if (w >= h) {
    layoutTreemap(a, x, y, w * ratio, h, out);
    layoutTreemap(b, x + w * ratio, y, w * (1 - ratio), h, out);
  } else {
    layoutTreemap(a, x, y, w, h * ratio, out);
    layoutTreemap(b, x, y + h * ratio, w, h * (1 - ratio), out);
  }
  return out;
}

/**
 * Treemap một sắc độ (đậm hơn = nhiều hơn). rows: [{ key, label, value, sub, href }]
 */
export function Treemap({ rows, label, unit, onSelect }) {
  const { lang } = usePrefs();
  const sorted = useMemo(() => [...rows].filter((r) => r.value > 0).sort((a, b) => b.value - a.value), [rows]);
  const max = sorted[0]?.value || 1;
  const tiles = useMemo(() => layoutTreemap(sorted, 0, 0, 100, 100, []), [sorted]);
  const total = sorted.reduce((s, r) => s + r.value, 0);
  const boxRef = useRef(null);
  const [box, setBox] = useState({ w: 600, h: 300 });
  // Chiều cao treemap cố định 300px; chỉ chiều rộng thay đổi theo khung.
  useEffect(() => {
    const el = boxRef.current?.parentElement;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => setBox((b) => ({ w: e.contentRect.width, h: b.h })));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const narrow = box.w < 480;
  return (
    <div className="treemap-wrap">
      {narrow && (
        // Màn hình hẹp: ô treemap quá nhỏ để ghi tên, nên đổi sang danh sách xếp hạng cùng thang màu.
        <ol className="tm-list" aria-label={label}>
          {sorted.map((r) => {
            const step = Math.min(5, 1 + Math.floor((r.value / max) * 4.999));
            return (
              <li key={r.key}>
                <button type="button" className="tm-list-row" onClick={() => onSelect?.(r)}>
                  <span className={`tm-swatch seq-${step}`} aria-hidden="true" />
                  <span className="tm-list-text">
                    <span className="tm-list-label">{r.label}</span>
                    {r.sub && <span className="tm-list-sub">{r.sub}</span>}
                  </span>
                  <span className="tm-list-value lk-num">{formatNumber(r.value, lang)}</span>
                  <span className="tm-list-pct lk-num">{pct(r.value, total, lang)}</span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
      <div className="treemap" role="list" aria-label={label} ref={boxRef} hidden={narrow}>
        {tiles.map((tile) => {
          const step = Math.min(5, 1 + Math.floor((tile.value / max) * 4.999));
          // Chọn cách hiện chữ theo kích thước thật (px) của ô để không bao giờ bị cắt chữ.
          const pw = (tile.w / 100) * box.w;
          const ph = (tile.h / 100) * box.h;
          const mode = pw >= 78 && ph >= 74 ? 'full' : pw >= 72 && ph >= 34 ? 'row' : 'tiny';
          const small = mode !== 'full';
          return (
            <button
              type="button"
              role="listitem"
              key={tile.key}
              className={`tm-tile seq-${step} is-${mode}`}
              style={{ left: `${tile.x}%`, top: `${tile.y}%`, width: `${tile.w}%`, height: `${tile.h}%` }}
              onClick={() => onSelect?.(tile)}
              title={`${tile.label}: ${formatNumber(tile.value, lang)} ${unit} (${pct(tile.value, total, lang)})`}
              aria-label={`${tile.label}: ${formatNumber(tile.value, lang)} ${unit}`}
            >
              <span className="tm-inner">
                <span className="tm-value lk-num">{formatNumber(tile.value, lang)}</span>
                {mode !== 'tiny' && <span className="tm-label">{tile.label}</span>}
                {!small && ph >= 96 && tile.sub && <span className="tm-sub">{tile.sub}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
