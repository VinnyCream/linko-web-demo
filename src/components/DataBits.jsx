import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import { useT, usePrefs } from '../state/prefs.jsx';
import { formatNumber, maskEmail, maskPhone } from '../lib/format.js';

// Email, số điện thoại: che mặc định; chỉ hr/admin mở được, tự che lại sau 15 giây hoặc khi rời tab.
export function MaskedField({ type = 'email', value, canReveal, revealSeconds = 15 }) {
  const t = useT();
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!shown) return undefined;
    const timer = setTimeout(() => setShown(false), revealSeconds * 1000);
    const onHide = () => document.hidden && setShown(false);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [shown, revealSeconds]);
  if (!value) return <span className="muted">{t('Chưa cập nhật')}</span>;
  const masked = type === 'email' ? maskEmail(value) : maskPhone(value);
  return (
    <span className="masked">
      <span className={shown ? 'masked-value' : 'masked-value is-hidden'}>
        {shown ? (type === 'email' ? <a href={`mailto:${value}`}>{value}</a> : <a href={`tel:${value}`}>{value}</a>) : masked}
      </span>
      {canReveal ? (
        <button type="button" className="link-btn" onClick={() => setShown((s) => !s)} aria-pressed={shown}>
          <Icon name={shown ? 'eye-slash' : 'eye'} size={12} />
          {shown ? t('Che') : t('Hiện')}
        </button>
      ) : (
        <span className="masked-lock" title={t('Chỉ Nhân sự và Quản trị viên xem được')}>
          <Icon name="lock" size={11} label={t('Đã che')} />
        </span>
      )}
    </span>
  );
}

// Độ mạnh kết nối 0 đến 5 (knows.strength). editable: dùng phím mũi tên hoặc bấm.
export function StrengthMeter({ value = 0, editable = false, onChange, showValue = true, label }) {
  const t = useT();
  const { lang } = usePrefs();
  const v = Number(value) || 0;
  const bars = [1, 2, 3, 4, 5];
  const onKey = (e) => {
    if (!editable) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') onChange?.(Math.min(5, Math.round((v + 0.5) * 2) / 2));
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') onChange?.(Math.max(0, Math.round((v - 0.5) * 2) / 2));
  };
  return (
    <span
      className={`meter${editable ? ' is-editable' : ''}`}
      role={editable ? 'slider' : 'img'}
      tabIndex={editable ? 0 : undefined}
      aria-label={label || t('Độ mạnh kết nối')}
      aria-valuemin={editable ? 0 : undefined}
      aria-valuemax={editable ? 5 : undefined}
      aria-valuenow={editable ? v : undefined}
      aria-valuetext={`${formatNumber(v, lang, 1)}/5`}
      title={`${formatNumber(v, lang, 1)}/5`}
      onKeyDown={onKey}
    >
      <span className="meter-bars" aria-hidden="true">
        {bars.map((b) => (
          <span
            key={b}
            className={`meter-bar${v >= b ? ' is-full' : v > b - 1 ? ' is-half' : ''}`}
            onClick={editable ? () => onChange?.(b) : undefined}
          />
        ))}
      </span>
      {showValue && <span className="meter-value lk-num">{formatNumber(v, lang, 1)}</span>}
    </span>
  );
}

// Con số chính: nhãn nhỏ phía trên, số lớn tabular, chú thích bên dưới. Không kèm icon trang trí.
export function Metric({ label, value, helper, tone, loading }) {
  const { lang } = usePrefs();
  return (
    <div className={`metric${tone ? ` metric-${tone}` : ''}`}>
      <span className="metric-label">{label}</span>
      {loading ? <span className="sk sk-line metric-sk" aria-hidden="true" /> : <span className="metric-value lk-num">{typeof value === 'number' ? formatNumber(value, lang) : value}</span>}
      {helper && <span className="metric-helper">{helper}</span>}
    </div>
  );
}

// Thanh ngang so sánh (biểu đồ thanh đơn giản, có nhãn và số).
export function BarList({ rows, max, tone = 'primary', format = (v) => v, empty }) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return empty || null;
  return (
    <ul className="barlist">
      {rows.map((r) => (
        <li key={r.key ?? r.label} className="barlist-row">
          <span className="barlist-label truncate" title={r.label}>
            {r.icon}
            {r.label}
          </span>
          <span className="barlist-track" aria-hidden="true">
            <span className={`barlist-fill tone-${r.tone || tone}`} style={{ '--pct': `${Math.max(2, (r.value / top) * 100)}%` }} />
          </span>
          <span className="barlist-value lk-num">{format(r.value)}</span>
        </li>
      ))}
    </ul>
  );
}
