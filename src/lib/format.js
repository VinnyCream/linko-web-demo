// Định dạng theo quy ước Linko: dd/MM/yyyy, 1.250, 4,5/5, thời gian tương đối.

/** Bỏ dấu tiếng Việt để tìm kiếm: "Kế toán" -> "ke toan", "Đặng" -> "dang". */
export function fold(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

/** Chữ cái đầu: "Đặng Quốc Huy" -> "ĐH" (họ + tên). */
export function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Số ổn định 0..n-1 theo chuỗi, dùng chọn màu avatar chữ cái. */
export function hashIndex(value, n) {
  let h = 0;
  const s = String(value || '');
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % n;
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const d = new Date(typeof value === 'string' && value.length === 10 ? value + 'T00:00:00' : value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(value, lang = 'vi') {
  const d = toDate(value);
  if (!d) return '';
  const p = (n) => String(n).padStart(2, '0');
  // Tiếng Anh: MM/dd/yyyy; tiếng Việt: dd/MM/yyyy
  if (lang === 'en') return `${p(d.getMonth() + 1)}/${p(d.getDate())}/${d.getFullYear()}`;
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function formatDateTime(value, lang = 'vi') {
  const d = toDate(value);
  if (!d) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${formatDate(d, lang)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function formatNumber(value, lang = 'vi', digits = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export function relTime(value, lang = 'vi', now = new Date()) {
  const d = toDate(value);
  if (!d) return '';
  const s = Math.round((now - d) / 1000);
  const vi = lang !== 'en';
  if (s < 45) return vi ? 'Vừa xong' : 'Just now';
  const m = Math.round(s / 60);
  if (m < 60) return vi ? `${m} phút trước` : `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return vi ? `${h} giờ trước` : `${h} h ago`;
  const days = Math.round(h / 24);
  if (days < 7) return vi ? `${days} ngày trước` : `${days} d ago`;
  return formatDate(d, lang);
}

export function maskEmail(value) {
  if (!value || !value.includes('@')) return value ? '••••••' : '';
  const [user, domain] = value.split('@');
  return `${user.slice(0, 1)}${'•'.repeat(Math.max(3, user.length - 1))}@${domain}`;
}

export function maskPhone(value) {
  if (!value) return '';
  const digits = String(value);
  return `${'•'.repeat(Math.max(4, digits.length - 3))}${digits.slice(-3)}`;
}

export function shortId(value, n = 8) {
  return value ? String(value).slice(0, n) : '';
}

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}
