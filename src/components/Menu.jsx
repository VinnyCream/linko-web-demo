import { useEffect, useId, useRef, useState } from 'react';
import Icon from './Icon.jsx';

// Menu thả xuống: mở bằng click/Enter/Space/ArrowDown, điều hướng bằng mũi tên, Esc đóng và trả focus.
// items: [{ id, label, icon, onSelect, tone, disabled } | { divider: true } | { render: () => node }]
export default function Menu({ trigger, items, align = 'end', label, className = '', width }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);
  const btn = useRef(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (!wrap.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDoc);
    const first = wrap.current?.querySelector('[role="menuitem"]:not([disabled])');
    first?.focus();
    return () => document.removeEventListener('pointerdown', onDoc);
  }, [open]);

  const onKey = (e) => {
    const nodes = [...(wrap.current?.querySelectorAll('[role="menuitem"]:not([disabled])') || [])];
    const i = nodes.indexOf(document.activeElement);
    if (e.key === 'Escape') {
      setOpen(false);
      btn.current?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      nodes[(i + 1) % nodes.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      nodes[(i - 1 + nodes.length) % nodes.length]?.focus();
    } else if (e.key === 'Tab') setOpen(false);
  };

  return (
    <div className={`menu-wrap ${className}`} ref={wrap} onKeyDown={open ? onKey : undefined}>
      {trigger({
        ref: btn,
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        'aria-controls': open ? menuId : undefined,
        onClick: () => setOpen((o) => !o),
        onKeyDown: (e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault();
            setOpen(true);
          }
        },
      })}
      {open && (
        <div id={menuId} className={`menu menu-${align}`} role="menu" aria-label={label} style={width ? { width } : undefined}>
          {items.filter(Boolean).map((item, idx) => {
            if (item.divider) return <div key={`d${idx}`} className="menu-divider" role="separator" />;
            if (item.render) return <div key={item.id || `r${idx}`} className="menu-custom">{item.render({ close: () => setOpen(false) })}</div>;
            return (
              <button
                key={item.id || item.label}
                type="button"
                role="menuitem"
                className={`menu-item${item.tone ? ` tone-${item.tone}` : ''}`}
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onSelect?.();
                }}
              >
                {item.icon && <Icon name={item.icon} size={16} />}
                <span className="menu-item-label">{item.label}</span>
                {item.hint && <span className="menu-hint">{item.hint}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
