import { useCallback, useEffect, useRef, useState } from 'react';

// Bộ nhớ đệm truy vấn nhỏ: stale-while-revalidate, huỷ khi rời trang, cờ "slow" cho thông điệp chờ.
const cache = new Map(); // key -> { data, ts }
const subscribers = new Map(); // key -> Set<fn>
const STALE_MS = 30_000;

export function invalidate(...prefixes) {
  [...cache.keys()].forEach((key) => {
    if (!prefixes.length || prefixes.some((p) => key.startsWith(p))) {
      cache.delete(key);
      subscribers.get(key)?.forEach((fn) => fn());
    }
  });
}

export function clearQueryCache() {
  cache.clear();
}

export function setQueryData(key, updater) {
  const prev = cache.get(key)?.data;
  const data = typeof updater === 'function' ? updater(prev) : updater;
  cache.set(key, { data, ts: Date.now() });
  subscribers.get(key)?.forEach((fn) => fn('local'));
}

/**
 * const { data, error, loading, slow, refetch } = useQuery('employees', () => api.employees())
 * slow = true khi chờ quá slowMs, dùng để hiện lời nhắn thân thiện.
 */
export function useQuery(key, fetcher, { enabled = true, slowMs = 1400, keepPrevious = true } = {}) {
  const cached = key ? cache.get(key) : undefined;
  const [state, setState] = useState(() => ({
    data: cached?.data,
    error: null,
    loading: enabled && !cached,
    slow: false,
  }));
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const runId = useRef(0);

  const run = useCallback(
    async ({ silent = false } = {}) => {
      if (!key || !enabled) return;
      const id = ++runId.current;
      const hit = cache.get(key);
      setState((s) => ({
        data: hit ? hit.data : keepPrevious ? s.data : undefined,
        error: null,
        loading: !silent && !hit,
        slow: false,
        refreshing: Boolean(hit),
      }));
      const slowTimer = setTimeout(() => {
        if (id === runId.current) setState((s) => ({ ...s, slow: true }));
      }, slowMs);
      try {
        const data = await fetcherRef.current();
        if (id !== runId.current) return;
        cache.set(key, { data, ts: Date.now() });
        setState({ data, error: null, loading: false, slow: false, refreshing: false });
      } catch (error) {
        if (id !== runId.current || error?.name === 'AbortError') return;
        setState((s) => ({ ...s, error, loading: false, slow: false, refreshing: false }));
      } finally {
        clearTimeout(slowTimer);
      }
    },
    [key, enabled, slowMs, keepPrevious],
  );

  useEffect(() => {
    if (!key || !enabled) {
      setState((s) => ({ ...s, loading: false }));
      return undefined;
    }
    const hit = cache.get(key);
    if (!hit || Date.now() - hit.ts > STALE_MS) run();
    else setState({ data: hit.data, error: null, loading: false, slow: false });
    const fn = (source) => {
      if (source === 'local') {
        const h = cache.get(key);
        setState((s) => ({ ...s, data: h?.data }));
      } else run();
    };
    if (!subscribers.has(key)) subscribers.set(key, new Set());
    subscribers.get(key).add(fn);
    return () => {
      subscribers.get(key)?.delete(fn);
      runId.current += 1;
    };
  }, [key, enabled, run]);

  return { ...state, refetch: () => run() };
}

/** Gọi API ghi, giữ trạng thái loading/success/error cho nút. */
export function useMutation(fn) {
  const [state, setState] = useState({ status: 'idle', error: null });
  const mounted = useRef(true);
  useEffect(() => () => {
    mounted.current = false;
  }, []);
  const mutate = useCallback(
    async (...args) => {
      setState({ status: 'loading', error: null });
      try {
        const result = await fn(...args);
        if (mounted.current) {
          setState({ status: 'success', error: null });
          setTimeout(() => mounted.current && setState((s) => (s.status === 'success' ? { status: 'idle', error: null } : s)), 1500);
        }
        return result;
      } catch (error) {
        if (mounted.current) setState({ status: 'error', error });
        throw error;
      }
    },
    [fn],
  );
  const reset = useCallback(() => setState({ status: 'idle', error: null }), []);
  return { ...state, mutate, reset, loading: state.status === 'loading' };
}
