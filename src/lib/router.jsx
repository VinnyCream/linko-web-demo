import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// Router nhỏ dựa trên History API (không cần thêm thư viện). Vercel rewrite mọi đường dẫn về index.html.
const RouterCtx = createContext(null);
const ParamsCtx = createContext({});

function currentLocation() {
  const { pathname, search, hash } = window.location;
  return { pathname, search, hash, query: new URLSearchParams(search) };
}

export function RouterProvider({ children }) {
  const [location, setLocation] = useState(currentLocation);

  useEffect(() => {
    const onPop = () => setLocation(currentLocation());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((to, { replace = false, state } = {}) => {
    if (typeof to === 'number') {
      window.history.go(to);
      return;
    }
    const url = new URL(to, window.location.origin);
    const next = url.pathname + url.search + url.hash;
    const same = next === window.location.pathname + window.location.search + window.location.hash;
    if (replace || same) window.history.replaceState(state ?? null, '', next);
    else window.history.pushState(state ?? null, '', next);
    setLocation(currentLocation());
    if (!url.hash) window.scrollTo({ top: 0 });
  }, []);

  const value = useMemo(() => ({ location, navigate }), [location, navigate]);
  return <RouterCtx.Provider value={value}>{children}</RouterCtx.Provider>;
}

export function useLocation() {
  return useContext(RouterCtx).location;
}

export function useNavigate() {
  return useContext(RouterCtx).navigate;
}

export function useParams() {
  return useContext(ParamsCtx);
}

export function ParamsProvider({ params, children }) {
  return <ParamsCtx.Provider value={params}>{children}</ParamsCtx.Provider>;
}

/** "/people/:id" khớp "/people/12" -> { id: "12" }. */
export function matchPath(pattern, pathname) {
  const clean = (s) => s.replace(/\/+$/, '') || '/';
  const a = clean(pattern).split('/');
  const b = clean(pathname).split('/');
  if (a.length !== b.length) return null;
  const params = {};
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].startsWith(':')) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}

export function Link({ to, replace, onClick, children, ...rest }) {
  const navigate = useNavigate();
  const handle = (event) => {
    onClick?.(event);
    if (
      event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
      rest.target === '_blank'
    ) return;
    event.preventDefault();
    navigate(to, { replace });
  };
  return (
    <a href={to} onClick={handle} {...rest}>
      {children}
    </a>
  );
}
