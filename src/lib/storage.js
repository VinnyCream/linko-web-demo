// Bộ nhớ trình duyệt chỉ dùng cho tiện ích của từng người xem (giao diện, ngôn ngữ, nháp).
// Không bao giờ lưu access token ở đây.
const PREFIX = 'linko:';

export function readStore(key, fallback = null) {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeStore(key, value) {
  try {
    if (value === undefined || value === null) window.localStorage.removeItem(PREFIX + key);
    else window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* private mode or quota: ignore, the app still works */
  }
}

export function readSession(key, fallback = null) {
  try {
    const raw = window.sessionStorage.getItem(PREFIX + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeSession(key, value) {
  try {
    if (value === undefined || value === null) window.sessionStorage.removeItem(PREFIX + key);
    else window.sessionStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}
