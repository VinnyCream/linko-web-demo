import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, clearApi, configureApi, decodeJwt, on, roleFromClaims } from '../api/client.js';
import { api } from '../api/endpoints.js';
import { clearQueryCache } from '../hooks/useQuery.js';
import { readSession, readStore, writeSession, writeStore } from '../lib/storage.js';

// Phiên làm việc. Access token chỉ nằm trong bộ nhớ (module client.js), tải lại trang là phải
// đăng nhập lại. Phiên demo không có bí mật nên được nhớ trong sessionStorage của tab.
const SessionCtx = createContext(null);

export const DEMO_PERSONAS = [
  { key: 'employee', role: 'employee', employeeId: 20, subject: 'vinh.ngo' },
  { key: 'hr', role: 'hr', employeeId: 33, subject: 'nga.do' },
  { key: 'admin', role: 'admin', employeeId: 3, subject: 'cuong.le' },
];

export const DEFAULT_API_BASE = (import.meta.env?.VITE_API_BASE_URL || '').trim();

export function SessionProvider({ children }) {
  const [session, setSession] = useState({ status: 'booting' });
  const [notice, setNotice] = useState(null); // lý do bị đăng xuất
  const returnTo = useRef(null);

  const finish = useCallback(async ({ mode, role, subject, employeeId, base, expiresAt }) => {
    let me = null;
    if (employeeId) {
      try {
        me = await api.employee(employeeId);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) throw err;
        me = null;
      }
    }
    if (!me && mode === 'api' && subject) {
      try {
        const list = await api.employees({ q: subject, status: 'ALL', limit: 5 });
        me = list.find((e) => e.email?.split('@')[0] === subject || e.email === subject) || null;
      } catch {
        me = null;
      }
    }
    setSession({ status: 'ready', mode, role, subject, me, base, expiresAt: expiresAt || null, startedAt: Date.now() });
  }, []);

  const loginDemo = useCallback(
    async (personaKey) => {
      const persona = DEMO_PERSONAS.find((p) => p.key === personaKey) || DEMO_PERSONAS[0];
      configureApi({ mode: 'demo', base: '', token: null, principal: { subject: persona.subject, role: persona.role } });
      writeSession('demo', persona.key);
      await finish({ mode: 'demo', role: persona.role, subject: persona.subject, employeeId: persona.employeeId });
    },
    [finish],
  );

  const loginWithToken = useCallback(
    async ({ base, token, employeeId }) => {
      const cleanBase = String(base || '').trim().replace(/\/+$/, '');
      const raw = String(token || '').trim().replace(/^Bearer\s+/i, '');
      const claims = decodeJwt(raw);
      if (!claims) throw new ApiError({ status: 400, code: 'TOKEN_FORMAT', message: 'Token không đúng định dạng JWT.' });
      const role = roleFromClaims(claims);
      if (!role) throw new ApiError({ status: 403, code: 'ROLE_REQUIRED', message: 'Token không có vai trò Linko.' });
      if (claims.exp && claims.exp * 1000 < Date.now()) throw new ApiError({ status: 401, code: 'INVALID_TOKEN', message: 'Access token đã hết hạn.' });
      configureApi({ mode: 'api', base: cleanBase, token: raw, principal: { subject: claims.sub, role } });
      try {
        await api.employees({ limit: 1, status: 'ALL' });
      } catch (err) {
        clearApi();
        throw err;
      }
      writeStore('api-base', cleanBase);
      const numeric = Number(employeeId || (/^\d+$/.test(String(claims.sub)) ? claims.sub : 0));
      writeStore('linked-employee', numeric || null);
      await finish({ mode: 'api', role, subject: claims.sub, employeeId: numeric || null, base: cleanBase, expiresAt: claims.exp ? claims.exp * 1000 : null });
    },
    [finish],
  );

  const logout = useCallback((reason = null) => {
    clearApi();
    clearQueryCache();
    writeSession('demo', null);
    setNotice(reason);
    setSession({ status: 'anon' });
  }, []);

  // Khôi phục phiên demo trong tab khi tải lại trang
  useEffect(() => {
    const demo = readSession('demo');
    if (demo) loginDemo(demo).catch(() => setSession({ status: 'anon' }));
    else setSession({ status: 'anon' });
  }, [loginDemo]);

  // 401 ở bất kỳ request nào: xoá token, về đăng nhập, nhớ trang đang xem
  useEffect(
    () =>
      on('unauthorized', () => {
        returnTo.current = window.location.pathname + window.location.search;
        logout('expired');
      }),
    [logout],
  );

  const takeReturnTo = useCallback(() => {
    const value = returnTo.current;
    returnTo.current = null;
    return value;
  }, []);

  const updateMe = useCallback((me) => setSession((s) => ({ ...s, me })), []);

  const value = useMemo(
    () => ({
      ...session,
      notice,
      clearNotice: () => setNotice(null),
      loginDemo,
      loginWithToken,
      logout,
      takeReturnTo,
      updateMe,
      savedBase: readStore('api-base', DEFAULT_API_BASE) || DEFAULT_API_BASE,
      savedEmployee: readStore('linked-employee', null),
    }),
    [session, notice, loginDemo, loginWithToken, logout, takeReturnTo, updateMe],
  );
  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>;
}

export function useSession() {
  return useContext(SessionCtx);
}
