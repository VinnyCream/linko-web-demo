import Icon from './Icon.jsx';
import { useT } from '../state/prefs.jsx';

export function Badge({ tone = 'neutral', icon, size = 'sm', children, className = '' }) {
  return (
    <span className={`badge badge-${tone} badge-${size} ${className}`}>
      {icon && <Icon name={icon} size={12} />}
      <span>{children}</span>
    </span>
  );
}

const EMP_STATUS = {
  ACTIVE: { tone: 'success', icon: 'circle-check', label: 'Đang làm việc' },
  ON_LEAVE: { tone: 'warning', icon: 'clock', label: 'Nghỉ phép' },
  INACTIVE: { tone: 'neutral', icon: 'ban', label: 'Đã nghỉ' },
};
const PROJECT_STATUS = {
  PLANNING: { tone: 'primary', icon: 'pen', label: 'Lên kế hoạch' },
  ACTIVE: { tone: 'success', icon: 'circle-play', label: 'Đang chạy' },
  ON_HOLD: { tone: 'warning', icon: 'circle-pause', label: 'Tạm dừng' },
  COMPLETED: { tone: 'neutral', icon: 'check-double', label: 'Hoàn tất' },
  CANCELLED: { tone: 'danger', icon: 'circle-xmark', label: 'Đã huỷ' },
};
export const EMPLOYEE_STATUS_LABEL = Object.fromEntries(Object.entries(EMP_STATUS).map(([k, v]) => [k, v.label]));
export const PROJECT_STATUS_LABEL = Object.fromEntries(Object.entries(PROJECT_STATUS).map(([k, v]) => [k, v.label]));

export function StatusBadge({ kind = 'employee', status, size = 'sm' }) {
  const t = useT();
  const map = kind === 'project' ? PROJECT_STATUS : EMP_STATUS;
  const s = map[status] || { tone: 'neutral', icon: 'circle', label: status || '' };
  return (
    <Badge tone={s.tone} icon={s.icon} size={size}>
      {t(s.label)}
    </Badge>
  );
}

export const CONNECTION_TYPES = {
  COLLEAGUE: { icon: 'briefcase', label: 'Đồng nghiệp', tone: 'colleague' },
  TEAMMATE: { icon: 'user-group', label: 'Đồng đội', tone: 'teammate' },
  MENTOR: { icon: 'graduation-cap', label: 'Người hướng dẫn', tone: 'mentor' },
  MENTEE: { icon: 'seedling', label: 'Được hướng dẫn', tone: 'mentee' },
  FRIEND: { icon: 'heart', label: 'Bạn bè', tone: 'friend' },
  FOLLOW: { icon: 'eye', label: 'Theo dõi', tone: 'follow' },
};

export function ConnectionTag({ type, auto = false, size = 'sm' }) {
  const t = useT();
  const c = CONNECTION_TYPES[type] || CONNECTION_TYPES.COLLEAGUE;
  return (
    <span className={`ctag ctag-${c.tone} ctag-${size}`} title={auto ? t('Tạo tự động từ dự án chung') : undefined}>
      <Icon name={c.icon} size={12} />
      <span>{t(c.label)}</span>
      {auto && <Icon name="bolt" size={11} label={t('Tự động')} />}
    </span>
  );
}

export function RoleBadge({ role }) {
  const t = useT();
  const map = { employee: ['neutral', 'user', 'Nhân viên'], hr: ['primary', 'id-badge', 'Nhân sự'], admin: ['warning', 'shield-halved', 'Quản trị viên'] };
  const [tone, icon, label] = map[role] || map.employee;
  return (
    <Badge tone={tone} icon={icon}>
      {t(label)}
    </Badge>
  );
}

export function CountBadge({ count, max = 99, tone = 'danger', label }) {
  if (!count) return null;
  return (
    <span className={`count-badge count-${tone}`} aria-label={label}>
      {count > max ? `${max}+` : count}
    </span>
  );
}
