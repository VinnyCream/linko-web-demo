import { useState } from 'react';
import { initials, hashIndex } from '../lib/format.js';
import { usePeople } from '../state/people.jsx';
import { useT } from '../state/prefs.jsx';

const TONES = ['colleague', 'teammate', 'mentor', 'mentee', 'friend', 'follow'];
const SIZES = { xs: 24, sm: 32, md: 40, lg: 56, xl: 96 };
const PRESENCE_LABEL = { online: 'Đang trực tuyến', away: 'Tạm vắng', offline: 'Ngoại tuyến' };

// Ảnh đại diện tròn; chưa có ảnh thì hiện chữ cái đầu tô màu ổn định theo tên.
// id: tự lấy ảnh đã tải lên và trạng thái trực tuyến. presence={false} để ẩn chấm.
export default function Avatar({ name, id, src, size = 'md', presence, className = '', decorative = false }) {
  const t = useT();
  const people = usePeople();
  const [broken, setBroken] = useState(false);
  const image = src ?? (id ? people?.avatarOf(id) : undefined);
  const state = presence === false ? undefined : presence ?? (id ? people?.presenceOf(id) : undefined);
  const px = SIZES[size] || SIZES.md;
  const tone = TONES[hashIndex(name, TONES.length)];
  const label = decorative ? undefined : state ? `${name}, ${t(PRESENCE_LABEL[state])}` : name;
  return (
    <span
      className={`avatar avatar-${size} tone-${tone} ${className}`}
      style={{ '--av': `${px}px` }}
      role={decorative ? undefined : 'img'}
      aria-label={label}
      aria-hidden={decorative || undefined}
      title={label}
    >
      {image && !broken ? (
        <img src={image} alt="" onError={() => setBroken(true)} draggable="false" />
      ) : (
        <span className="avatar-initials" aria-hidden="true">{initials(name)}</span>
      )}
      {state && <span className={`presence presence-${state}`} aria-hidden="true" />}
    </span>
  );
}

export function AvatarStack({ people = [], max = 4, size = 'sm' }) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <span className="avatar-stack">
      {shown.map((p) => (
        <Avatar key={p.id ?? p.name} id={p.id} name={p.name} size={size} presence={false} />
      ))}
      {rest > 0 && <span className={`avatar avatar-${size} avatar-more`} style={{ '--av': `${SIZES[size]}px` }}>+{rest}</span>}
    </span>
  );
}
