import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon.jsx';
import { Button } from './Button.jsx';
import { useT } from '../state/prefs.jsx';
import { Skeleton } from './Feedback.jsx';

// Hộp thoại: bẫy focus, Esc để đóng, trả focus về nút đã mở. Trên điện thoại thành sheet từ dưới lên.
export function Dialog({ open, onClose, title, description, icon, tone = 'neutral', footer, size = 'md', children, initialFocus }) {
  const t = useT();
  const ref = useRef(null);
  const titleId = useId();
  const descId = useId();
  const lastFocus = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    lastFocus.current = document.activeElement;
    document.body.classList.add('no-scroll');
    const node = ref.current;
    const focusFirst = () => {
      const target = (initialFocus && node.querySelector(initialFocus)) ||
        node.querySelector('[data-autofocus]') ||
        node.querySelector('input:not([disabled]), textarea, select, button:not(.dialog-x)');
      target?.focus();
    };
    const id = requestAnimationFrame(focusFirst);
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current?.();
      }
      if (e.key === 'Tab') {
        const items = [...node.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')];
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    node.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(id);
      node.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
      lastFocus.current?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="dialog-layer">
      <div className="scrim" onClick={onClose} aria-hidden="true" />
      <div ref={ref} className={`dialog dialog-${size} dialog-${tone}`} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descId : undefined}>
        <header className="dialog-head">
          {icon && (
            <span className={`dialog-icon tone-${tone}`} aria-hidden="true">
              <Icon name={icon} size={18} />
            </span>
          )}
          <div className="dialog-titles">
            <h2 id={titleId} className="t-h4">{title}</h2>
            {description && <p id={descId} className="dialog-desc">{description}</p>}
          </div>
          <button type="button" className="dialog-x ibtn ibtn-ghost ibtn-sm" onClick={onClose} aria-label={t('Đóng')}>
            <Icon name="xmark" size={16} />
          </button>
        </header>
        <div className="dialog-body">{children}</div>
        {footer && <footer className="dialog-foot">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

// Xác nhận thao tác nguy hiểm: hiện số bản ghi bị ảnh hưởng (delete-impact) và có thể bắt gõ lại tên.
export function ConfirmDialog({ open, onClose, onConfirm, title, description, impact, impactLoading, confirmText, confirmLabel, state, tone = 'danger', disabled = false, children }) {
  const t = useT();
  const [typed, setTyped] = useState('');
  useEffect(() => {
    if (!open) setTyped('');
  }, [open]);
  const blocked = confirmText && typed.trim() !== confirmText;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      icon={tone === 'danger' ? 'triangle-exclamation' : 'circle-info'}
      tone={tone}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('Huỷ')}
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} disabled={blocked || impactLoading || disabled} state={state}>
            {confirmLabel || t('Xoá')}
          </Button>
        </>
      }
    >
      {impactLoading && <Skeleton lines={3} />}
      {impact?.length > 0 && (
        <ul className="impact-list">
          {impact.map((row) => (
            <li key={row.label}>
              <Icon name={row.icon || 'link'} size={14} />
              <span>{row.label}</span>
              <strong className="lk-num">{row.count}</strong>
            </li>
          ))}
        </ul>
      )}
      {children}
      {confirmText && (
        <label className="field">
          <span className="field-label">{t('Gõ "{text}" để xác nhận', { text: confirmText })}</span>
          <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck="false" />
        </label>
      )}
    </Dialog>
  );
}
