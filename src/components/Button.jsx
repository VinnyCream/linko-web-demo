import { forwardRef } from 'react';
import Icon from './Icon.jsx';
import Tooltip from './Tooltip.jsx';
import { useT } from '../state/prefs.jsx';

// Nút có chữ: primary | secondary | ghost | danger, cỡ sm 32 / md 40 / lg 48.
// state="loading" giữ nguyên độ rộng, tự vô hiệu, có aria-busy; "success" hiện dấu tích ngắn.
export const Button = forwardRef(function Button(
  { variant = 'secondary', size = 'md', iconStart, iconEnd, state, block, className = '', children, disabled, type = 'button', ...rest },
  ref,
) {
  const t = useT();
  const busy = state === 'loading';
  return (
    <button
      ref={ref}
      type={type}
      className={`btn btn-${variant} btn-${size}${block ? ' btn-block' : ''}${state ? ` is-${state}` : ''} ${className}`}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      <span className="btn-inner">
        {iconStart && <Icon name={iconStart} size={size === 'sm' ? 14 : 16} />}
        <span className="btn-label">{children}</span>
        {iconEnd && <Icon name={iconEnd} size={size === 'sm' ? 14 : 16} />}
      </span>
      {busy && (
        <span className="btn-state" aria-hidden="true">
          <span className="spinner" />
        </span>
      )}
      {state === 'success' && (
        <span className="btn-state">
          <Icon name="check" size={16} anim="pop" label={t('Xong')} />
        </span>
      )}
    </button>
  );
});

// Nút chỉ có biểu tượng: bắt buộc label (aria-label + tooltip). pressed biến thành toggle.
export const IconButton = forwardRef(function IconButton(
  { icon, label, pressed, badge, ping, anim, animKey, variant = 'ghost', size = 'md', tooltip = true, placement = 'bottom', className = '', type = 'button', ...rest },
  ref,
) {
  const btn = (
    <button
      ref={ref}
      type={type}
      className={`ibtn ibtn-${variant} ibtn-${size}${pressed ? ' is-pressed' : ''} ${className}`}
      aria-label={label}
      aria-pressed={pressed === undefined ? undefined : pressed}
      {...rest}
    >
      <Icon name={icon} filled={pressed} size={size === 'sm' ? 16 : 18} anim={anim} animKey={animKey} />
      {badge > 0 && <span className="count-badge ibtn-badge">{badge > 99 ? '99+' : badge}</span>}
      {ping ? <Ping key={ping} /> : null}
    </button>
  );
  return tooltip ? (
    <Tooltip content={label} placement={placement}>
      {btn}
    </Tooltip>
  ) : (
    btn
  );
});

// Ba nét "ping" lấy từ tai mèo trong logo: vẽ ra rồi mờ đi, chạy một lần.
export function Ping() {
  return (
    <svg className="ping" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M15 6 L18 3" />
      <path d="M17 9 L21 8" />
      <path d="M12 5 L12.5 1.5" />
    </svg>
  );
}
