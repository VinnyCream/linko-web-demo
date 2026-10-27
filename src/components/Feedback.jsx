import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import { Button } from './Button.jsx';
import { useT } from '../state/prefs.jsx';
import { describeError } from '../lib/errors.js';
import { shortId } from '../lib/format.js';
import { useToast } from './Toast.jsx';

export function Spinner({ size = 16, label }) {
  return <span className="spinner" style={{ '--sp': `${size}px` }} role={label ? 'status' : undefined} aria-label={label} />;
}

// Skeleton đúng hình nội dung. variant: line | circle | block | post | row | tile
export function Skeleton({ variant = 'line', width, height, lines = 1, className = '' }) {
  if (variant === 'post') {
    return (
      <div className={`sk-post ${className}`} aria-hidden="true">
        <div className="sk-row">
          <span className="sk sk-circle" style={{ '--w': '40px', '--h': '40px' }} />
          <span className="sk-col">
            <span className="sk sk-line" style={{ '--w': '42%' }} />
            <span className="sk sk-line sk-thin" style={{ '--w': '26%' }} />
          </span>
        </div>
        <span className="sk sk-line" style={{ '--w': '96%' }} />
        <span className="sk sk-line" style={{ '--w': '88%' }} />
        <span className="sk sk-line" style={{ '--w': '54%' }} />
      </div>
    );
  }
  if (variant === 'row') {
    return (
      <div className={`sk-row sk-listrow ${className}`} aria-hidden="true">
        <span className="sk sk-circle" style={{ '--w': '32px', '--h': '32px' }} />
        <span className="sk-col">
          <span className="sk sk-line" style={{ '--w': width || '38%' }} />
          <span className="sk sk-line sk-thin" style={{ '--w': '24%' }} />
        </span>
      </div>
    );
  }
  if (lines > 1) {
    return (
      <span className={`sk-col ${className}`} aria-hidden="true">
        {Array.from({ length: lines }, (_, i) => (
          <span key={i} className="sk sk-line" style={{ '--w': i === lines - 1 ? '60%' : '100%' }} />
        ))}
      </span>
    );
  }
  return <span className={`sk sk-${variant} ${className}`} style={{ '--w': width, '--h': height }} aria-hidden="true" />;
}

export function SkeletonList({ count = 6, variant = 'row' }) {
  const t = useT();
  return (
    <div className="sk-list" role="status" aria-label={t('Đang tải')}>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} variant={variant} width={`${30 + ((i * 17) % 30)}%`} />
      ))}
    </div>
  );
}

const SLOW_LINES = [
  'Đang lấy dữ liệu từ Oracle 23ai, chờ một chút nhé.',
  'Đồ thị nhiều kết nối nên cần thêm vài giây để dựng.',
  'Vẫn đang làm việc. Kết nối hôm nay chậm hơn thường lệ một chút.',
  'Sắp xong rồi. Cảm ơn bạn đã kiên nhẫn.',
];

// Lời nhắn khi tải lâu: hiện khi slow = true, đổi câu mỗi 3,5 giây.
export function LoadingNote({ slow, lines = SLOW_LINES, compact = false }) {
  const t = useT();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!slow) {
      setI(0);
      return undefined;
    }
    const id = setInterval(() => setI((x) => Math.min(x + 1, lines.length - 1)), 3500);
    return () => clearInterval(id);
  }, [slow, lines.length]);
  if (!slow) return null;
  return (
    <div className={`loading-note${compact ? ' is-compact' : ''}`} role="status" aria-live="polite">
      <span className="dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span key={i} className="loading-note-text">{t(lines[i])}</span>
    </div>
  );
}

export function Banner({ tone = 'info', title, icon, action, onAction, onClose, children, className = '' }) {
  const t = useT();
  const icons = { info: 'circle-info', success: 'circle-check', warning: 'triangle-exclamation', danger: 'circle-exclamation' };
  return (
    <div className={`banner banner-${tone} ${className}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <Icon name={icon || icons[tone]} size={18} filled />
      <div className="banner-body">
        {title && <p className="banner-title">{title}</p>}
        {children && <div className="banner-text">{children}</div>}
      </div>
      {action && (
        <Button size="sm" variant={tone === 'danger' ? 'secondary' : 'ghost'} onClick={onAction}>
          {action}
        </Button>
      )}
      {onClose && (
        <button type="button" className="banner-close" onClick={onClose} aria-label={t('Đóng')}>
          <Icon name="xmark" size={14} />
        </button>
      )}
    </div>
  );
}

export function EmptyState({ variant = 'empty', icon, mascot = false, title, description, action, onAction, actionIcon, secondary, onSecondary, compact = false, children }) {
  const icons = { empty: 'folder-open', search: 'magnifying-glass', error: 'triangle-exclamation', forbidden: 'lock', offline: 'plug-circle-xmark' };
  return (
    <div className={`empty${compact ? ' is-compact' : ''} empty-${variant}`}>
      {mascot ? (
        <img className="empty-mascot" src="/brand/linko-mark.png" alt="" width="72" height="68" />
      ) : (
        <span className="empty-icon" aria-hidden="true">
          <Icon name={icon || icons[variant]} size={compact ? 20 : 24} />
        </span>
      )}
      <h2 className={compact ? 't-h4' : 't-h3'}>{title}</h2>
      {description && <p className="empty-desc">{description}</p>}
      {children}
      {(action || secondary) && (
        <div className="empty-actions">
          {action && (
            <Button variant="primary" iconStart={actionIcon} onClick={onAction}>
              {action}
            </Button>
          )}
          {secondary && (
            <Button variant="ghost" onClick={onSecondary}>
              {secondary}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function RequestId({ id }) {
  const t = useT();
  const toast = useToast();
  if (!id) return null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(id);
      toast.show({ tone: 'success', title: t('Đã sao chép Mã yêu cầu') });
    } catch {
      /* clipboard bị chặn: người dùng vẫn đọc được mã */
    }
  };
  return (
    <span className="request-id">
      <span>{t('Mã yêu cầu')}</span>
      <code className="t-mono-sm">{shortId(id, 12)}</code>
      <button type="button" className="link-btn" onClick={copy}>
        <Icon name="copy" size={12} />
        {t('Sao chép')}
      </button>
    </span>
  );
}

// Lỗi khi tải một khối dữ liệu: nói chuyện gì xảy ra, cách sửa, có Thử lại và Mã yêu cầu.
export function ErrorState({ error, onRetry, compact = false }) {
  const t = useT();
  const info = describeError(error, t);
  const variant = info.kind === 'forbidden' ? 'forbidden' : info.kind === 'network' ? 'offline' : 'error';
  return (
    <EmptyState
      variant={variant}
      compact={compact}
      title={info.title}
      description={info.message}
      action={onRetry && info.kind !== 'forbidden' ? t('Thử lại') : undefined}
      actionIcon="rotate-right"
      onAction={onRetry}
    >
      <RequestId id={info.requestId} />
    </EmptyState>
  );
}
