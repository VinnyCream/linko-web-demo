// HTTP client cho Linko FastAPI V7.
// - Access token chỉ giữ trong bộ nhớ module (không localStorage, không cookie, không URL).
// - Mọi lỗi được chuẩn hoá thành ApiError { status, code, message, requestId }.
// - Chế độ demo chuyển request sang mock server có cùng hình dữ liệu và cùng luật phân quyền.

export class ApiError extends Error {
  constructor({ status = 0, code = 'UNKNOWN', message = '', requestId = null, detail = null }) {
    super(message || code);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.detail = detail;
  }
}

const config = {
  mode: 'none', // 'api' | 'demo' | 'none'
  base: '',
  token: null,
  principal: null,
  timeoutMs: 20000,
};

const listeners = { unauthorized: new Set(), inflight: new Set(), unavailable: new Set() };
let inflight = 0;
let mockModule = null;

function emit(type, payload) {
  listeners[type].forEach((fn) => {
    try {
      fn(payload);
    } catch {
      /* ignore listener errors */
    }
  });
}

export function on(type, fn) {
  listeners[type].add(fn);
  return () => listeners[type].delete(fn);
}

export function configureApi(next) {
  Object.assign(config, next);
}

export function getApiConfig() {
  return { mode: config.mode, base: config.base, principal: config.principal };
}

export function clearApi() {
  config.mode = 'none';
  config.token = null;
  config.principal = null;
}

function setInflight(delta) {
  inflight = Math.max(0, inflight + delta);
  emit('inflight', inflight);
}

function buildUrl(path, query) {
  const base = config.base.replace(/\/+$/, '');
  const url = new URL(base + path, window.location.origin);
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    });
  }
  return url.toString();
}

async function parseError(response) {
  const requestId = response.headers.get('X-Request-ID');
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  const detail = body?.detail;
  let code = `HTTP_${response.status}`;
  let message = '';
  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    code = detail.code || code;
    message = detail.message || '';
  } else if (Array.isArray(detail)) {
    // Lỗi validate của FastAPI (422): [{loc, msg, type}]
    code = 'VALIDATION_ERROR';
    message = detail.map((d) => `${(d.loc || []).slice(1).join('.')}: ${d.msg}`).join('; ');
  } else if (typeof detail === 'string') {
    message = detail;
  }
  if (response.status === 502 || response.status === 504) code = code.startsWith('HTTP_') ? 'BAD_GATEWAY' : code;
  return new ApiError({ status: response.status, code, message, requestId, detail: body?.detail ?? null });
}

/**
 * request('GET', '/api/employees', { query: { q: 'lan' } })
 */
export async function request(method, path, { query, body, signal } = {}) {
  if (config.mode === 'none') throw new ApiError({ status: 401, code: 'AUTH_REQUIRED', message: 'Cần đăng nhập.' });
  setInflight(1);
  try {
    if (config.mode === 'demo') {
      if (!mockModule) mockModule = await import('./mock/server.js');
      return await mockModule.handle({ method, path, query, body, principal: config.principal, signal });
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new DOMException('timeout', 'TimeoutError')), config.timeoutMs);
    signal?.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
    let response;
    try {
      response = await fetch(buildUrl(path, query), {
        method,
        headers: {
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(config.token ? { Authorization: `Bearer ${config.token}` } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
        credentials: 'omit',
        cache: 'no-store',
      });
    } catch (err) {
      if (signal?.aborted) throw err;
      const timedOut = err?.name === 'TimeoutError' || controller.signal.reason?.name === 'TimeoutError';
      const apiErr = new ApiError({
        status: 0,
        code: timedOut ? 'TIMEOUT' : 'NETWORK_ERROR',
        message: timedOut ? 'Máy chủ phản hồi quá lâu.' : 'Không gọi được máy chủ API.',
      });
      emit('unavailable', apiErr);
      throw apiErr;
    } finally {
      clearTimeout(timer);
    }
    if (!response.ok) {
      const err = await parseError(response);
      if (err.status === 401) emit('unauthorized', err);
      if (err.status === 503 || err.status === 502) emit('unavailable', err);
      throw err;
    }
    if (response.status === 204) return null;
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  } catch (err) {
    if (err instanceof ApiError && config.mode === 'demo') {
      if (err.status === 401) emit('unauthorized', err);
      if (err.status === 503) emit('unavailable', err);
    }
    throw err;
  } finally {
    setInflight(-1);
  }
}

/** Giải mã phần payload JWT để hiển thị vai trò và hạn dùng. Không xác thực chữ ký (việc của backend). */
export function decodeJwt(token) {
  try {
    const part = token.split('.')[1];
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '='));
    const bytes = Uint8Array.from(json, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

export function roleFromClaims(claims) {
  const roles = Array.isArray(claims?.roles) ? claims.roles : [];
  return ['admin', 'hr', 'employee'].find((r) => roles.includes(r)) || null;
}
