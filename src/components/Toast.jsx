import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { useT } from '../state/prefs.jsx';
import { shortId } from '../lib/format.js';
import { describeError } from '../lib/errors.js';

// Toast góc dưới phải (điện thoại: trên thanh dưới). Tự ẩn sau 6 giây, dừng khi di chuột hoặc focus.
// Lỗi giữ tới khi đóng và có Mã yêu cầu. action dùng cho Hoàn tác.
const ToastCtx = createContext(null);
let seq = 0;

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const dismiss = useCallback((id) => setItems((list) => list.map((x) => (x.id === id ? { ...x, leaving: true } : x))), []);
  const remove = useCallback((id) => setItems((list) => list.filter((x) => x.id !== id)), []);
  const show = useCallback((toast) => {
    const id = ++seq;
    setItems((list) => [...list.slice(-3), { id, tone: 'info', duration: toast.tone === 'danger' ? 0 : 6000, ...toast }]);
    return id;
  }, []);
  const api = useMemo(() => ({ show, dismiss }), [show, dismiss]);
  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-relevant="additions">
        {items.map((item) => (
          <ToastItem key={item.id} item={item} onDismiss={() => dismiss(item.id)} onGone={() => remove(item.id)} />
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

function ToastItem({ item, onDismiss, onGone }) {
  const t = useT();
  const [paused, setPaused] = useState(false);
  const remaining = useRef(item.duration);
  const started = useRef(Date.now());
  useEffect(() => {
    if (!item.duration || paused || item.leaving) return undefined;
    started.current = Date.now();
    const id = setTimeout(onDismiss, remaining.current);
    return () => {
      clearTimeout(id);
      remaining.current -= Date.now() - started.current;
    };
  }, [paused, item.duration, item.leaving, onDismiss]);
  useEffect(() => {
    if (!item.leaving) return undefined;
    const id = setTimeout(onGone, 180);
    return () => clearTimeout(id);
  }, [item.leaving, onGone]);
  const icons = { info: 'circle-info', success: 'circle-check', warning: 'triangle-exclamation', danger: 'circle-exclamation' };
  const copy = () => navigator.clipboard?.writeText(item.requestId).catch(() => {});
  return (
    <div
      className={`toast toast-${item.tone}${item.leaving ? ' is-leaving' : ''}`}
      role={item.tone === 'danger' ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <Icon name={icons[item.tone]} size={18} filled className="toast-icon" />
      <div className="toast-body">
        {item.title && <p className="toast-title">{item.title}</p>}
        {item.message && <p className="toast-msg">{item.message}</p>}
        {item.requestId && (
          <p className="toast-rid">
            {t('Mã yêu cầu')} <code className="t-mono-sm">{shortId(item.requestId, 12)}</code>
            <button type="button" className="link-btn" onClick={copy}>
              {t('Sao chép')}
            </button>
          </p>
        )}
      </div>
      {item.action && (
        <button
          type="button"
          className="toast-action"
          onClick={() => {
            item.onAction?.();
            onDismiss();
          }}
        >
          {item.action}
        </button>
      )}
      <button type="button" className="toast-close" onClick={onDismiss} aria-label={t('Đóng thông báo')}>
        <Icon name="xmark" size={14} />
      </button>
    </div>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}

/** Toast lỗi chuẩn từ ApiError. */
export function useErrorToast() {
  const toast = useToast();
  const t = useT();
  return useCallback(
    (error) => {
      const info = describeError(error, t);
      toast.show({ tone: 'danger', title: info.title, message: info.message, requestId: info.requestId });
    },
    [toast, t],
  );
}
