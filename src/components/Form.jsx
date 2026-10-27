import { forwardRef, useEffect, useId, useMemo, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import Avatar from './Avatar.jsx';
import { useT } from '../state/prefs.jsx';
import { usePeople } from '../state/people.jsx';
import { fold } from '../lib/format.js';

export const TextField = forwardRef(function TextField(
  { label, hint, error, iconStart, multiline, rows = 3, className = '', counter, maxLength, required, id: idProp, ...rest },
  ref,
) {
  const autoId = useId();
  const id = idProp || autoId;
  const hintId = `${id}-hint`;
  const Tag = multiline ? 'textarea' : 'input';
  const length = String(rest.value ?? '').length;
  return (
    <div className={`field${error ? ' has-error' : ''} ${className}`}>
      {label && (
        <label className="field-label" htmlFor={id}>
          {label}
          {required && <span className="req" aria-hidden="true"> *</span>}
        </label>
      )}
      <div className={`input-wrap${iconStart ? ' has-icon' : ''}`}>
        {iconStart && <Icon name={iconStart} size={16} className="input-icon" />}
        <Tag
          ref={ref}
          id={id}
          className={`input${multiline ? ' textarea' : ''}`}
          rows={multiline ? rows : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={hint || error ? hintId : undefined}
          maxLength={maxLength}
          required={required}
          {...rest}
        />
      </div>
      {(hint || error || counter) && (
        <div className="field-foot">
          {(error || hint) && (
            <p id={hintId} className={error ? 'field-error' : 'field-hint'}>
              {error && <Icon name="circle-exclamation" size={12} filled />}
              {error || hint}
            </p>
          )}
          {counter && maxLength && <span className="field-count lk-num">{length}/{maxLength}</span>}
        </div>
      )}
    </div>
  );
});

export function Select({ label, hint, error, options = [], className = '', id: idProp, required, ...rest }) {
  const autoId = useId();
  const id = idProp || autoId;
  return (
    <div className={`field${error ? ' has-error' : ''} ${className}`}>
      {label && (
        <label className="field-label" htmlFor={id}>
          {label}
          {required && <span className="req" aria-hidden="true"> *</span>}
        </label>
      )}
      <div className="select-wrap">
        <select id={id} className="input select" aria-invalid={error ? true : undefined} required={required} {...rest}>
          {options.map((o) => (
            <option key={String(o.value)} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
        <Icon name="chevron-down" size={12} className="select-caret" />
      </div>
      {(hint || error) && <p className={error ? 'field-error' : 'field-hint'}>{error || hint}</p>}
    </div>
  );
}

export function Switch({ checked, onChange, label, description, disabled, id: idProp }) {
  const autoId = useId();
  const id = idProp || autoId;
  return (
    <div className="switch-row">
      <span className="switch-text">
        <label htmlFor={id} className="switch-label">{label}</label>
        {description && <span className="switch-desc">{description}</span>}
      </span>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={Boolean(checked)}
        className="switch"
        disabled={disabled}
        onClick={() => onChange?.(!checked)}
      >
        <span className="switch-knob" />
      </button>
    </div>
  );
}

export function Checkbox({ checked, indeterminate, onChange, label, disabled, ...rest }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminate);
  }, [indeterminate]);
  return (
    <label className={`checkbox${disabled ? ' is-disabled' : ''}`}>
      <input ref={ref} type="checkbox" checked={Boolean(checked)} onChange={(e) => onChange?.(e.target.checked)} disabled={disabled} {...rest} />
      <span className="checkbox-box" aria-hidden="true">
        <Icon name={indeterminate ? 'minus' : 'check'} size={11} filled />
      </span>
      {label && <span className="checkbox-label">{label}</span>}
    </label>
  );
}

// Nhóm nút chọn một (radio). Dùng cho giao diện, ngôn ngữ, chế độ xem.
export function SegmentedControl({ options, value, onChange, label, size = 'md', className = '' }) {
  const refs = useRef([]);
  const index = options.findIndex((o) => o.value === value);
  const onKey = (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    let next = index;
    if (e.key === 'ArrowRight') next = (index + 1) % options.length;
    if (e.key === 'ArrowLeft') next = (index - 1 + options.length) % options.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = options.length - 1;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };
  return (
    <div className={`seg seg-${size} ${className}`} role="radiogroup" aria-label={label} onKeyDown={onKey}>
      {options.map((o, i) => (
        <button
          key={o.value}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          tabIndex={o.value === value || (index < 0 && i === 0) ? 0 : -1}
          className={`seg-btn${o.value === value ? ' is-on' : ''}`}
          onClick={() => onChange(o.value)}
          aria-label={o.iconOnly ? o.label : undefined}
          title={o.iconOnly ? o.label : undefined}
        >
          {o.icon && <Icon name={o.icon} size={14} filled={o.value === value} />}
          {!o.iconOnly && <span>{o.label}</span>}
        </button>
      ))}
    </div>
  );
}

// Tabs có vạch chỉ báo, phím mũi tên, đếm số.
export function Tabs({ tabs, value, onChange, label, className = '' }) {
  const refs = useRef([]);
  const index = Math.max(0, tabs.findIndex((x) => x.value === value));
  const onKey = (e) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault();
    const next = e.key === 'ArrowRight' ? (index + 1) % tabs.length : (index - 1 + tabs.length) % tabs.length;
    onChange(tabs[next].value);
    refs.current[next]?.focus();
  };
  return (
    <div className={`tabs ${className}`} role="tablist" aria-label={label} onKeyDown={onKey}>
      {tabs.map((tab, i) => (
        <button
          key={tab.value}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="tab"
          aria-selected={tab.value === value}
          tabIndex={tab.value === value ? 0 : -1}
          className={`tab${tab.value === value ? ' is-on' : ''}`}
          onClick={() => onChange(tab.value)}
        >
          {tab.icon && <Icon name={tab.icon} size={14} filled={tab.value === value} />}
          <span>{tab.label}</span>
          {tab.count !== undefined && <span className="tab-count lk-num">{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}

// Chọn một nhân viên: gõ không dấu vẫn tìm được ("ngo van vinh").
export function PersonPicker({ label, value, onChange, excludeIds = [], placeholder, hint, error, required, onlyActive = true, id: idProp }) {
  const t = useT();
  const { people, byId } = usePeople();
  const autoId = useId();
  const id = idProp || autoId;
  const listId = `${id}-list`;
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const selected = value ? byId.get(Number(value)) : null;
  const results = useMemo(() => {
    const f = fold(text);
    const ex = new Set(excludeIds.map(Number));
    return people
      .filter((p) => (!onlyActive || p.status === 'ACTIVE') && !ex.has(p.employee_id))
      .filter((p) => !f || fold(`${p.full_name} ${p.title || ''} ${p.department_name || ''} ${p.email || ''}`).includes(f))
      .slice(0, 8);
  }, [people, text, excludeIds, onlyActive]);

  const pick = (p) => {
    onChange(p ? p.employee_id : null);
    setText('');
    setOpen(false);
  };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter' && open && results[active]) {
      e.preventDefault();
      pick(results[active]);
    } else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div className={`field picker${error ? ' has-error' : ''}`}>
      {label && (
        <label className="field-label" htmlFor={id}>
          {label}
          {required && <span className="req" aria-hidden="true"> *</span>}
        </label>
      )}
      {selected ? (
        <div className="picker-chosen">
          <Avatar id={selected.employee_id} name={selected.full_name} size="sm" />
          <span className="picker-chosen-text">
            <span className="t-label truncate">{selected.full_name}</span>
            <span className="muted t-caption truncate">{[selected.title, selected.department_name].filter(Boolean).join(', ')}</span>
          </span>
          <button type="button" className="ibtn ibtn-ghost ibtn-sm" onClick={() => pick(null)} aria-label={t('Bỏ chọn {name}', { name: selected.full_name })}>
            <Icon name="xmark" size={14} />
          </button>
        </div>
      ) : (
        <div className="input-wrap has-icon">
          <Icon name="magnifying-glass" size={14} className="input-icon" />
          <input
            id={id}
            className="input"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && results[active] ? `${listId}-${results[active].employee_id}` : undefined}
            value={text}
            placeholder={placeholder || t('Gõ tên, chức danh hoặc phòng ban')}
            onChange={(e) => {
              setText(e.target.value);
              setOpen(true);
              setActive(0);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
            onKeyDown={onKey}
            autoComplete="off"
          />
          {open && (
            <ul id={listId} className="picker-list" role="listbox">
              {results.length === 0 && <li className="picker-empty">{t('Không tìm thấy “{q}”', { q: text })}</li>}
              {results.map((p, i) => (
                <li
                  key={p.employee_id}
                  id={`${listId}-${p.employee_id}`}
                  role="option"
                  aria-selected={i === active}
                  className={`picker-opt${i === active ? ' is-active' : ''}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(p)}
                  onMouseEnter={() => setActive(i)}
                >
                  <Avatar id={p.employee_id} name={p.full_name} size="xs" presence={false} decorative />
                  <span className="truncate">{p.full_name}</span>
                  <span className="muted t-caption truncate">{p.title}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {(hint || error) && <p className={error ? 'field-error' : 'field-hint'}>{error || hint}</p>}
    </div>
  );
}
