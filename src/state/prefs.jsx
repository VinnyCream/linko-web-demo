import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { readStore, writeStore } from '../lib/storage.js';
import EN from '../lib/i18n-en.js';

// Giao diện (sáng, tối, theo hệ thống), ngôn ngữ (vi, en) và thanh bên thu gọn.
// Chỉ là tiện ích cho người xem, lưu theo trình duyệt.
const PrefsCtx = createContext(null);

function systemTheme() {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function PrefsProvider({ children }) {
  const [themePref, setThemePref] = useState(() => readStore('theme-v2', 'light'));
  const [lang, setLangState] = useState(() => readStore('lang', 'vi'));
  const [collapsed, setCollapsedState] = useState(() => readStore('sidebar-collapsed', false));
  const [resolved, setResolved] = useState(() => (themePref === 'system' ? systemTheme() : themePref));

  useEffect(() => {
    const apply = () => setResolved(themePref === 'system' ? systemTheme() : themePref);
    apply();
    if (themePref !== 'system') return undefined;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, [themePref]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolved);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', resolved === 'dark' ? '#0c1220' : '#f4f7fb');
  }, [resolved]);

  useEffect(() => {
    document.documentElement.setAttribute('lang', lang);
  }, [lang]);

  const setTheme = useCallback((value) => {
    setThemePref(value);
    writeStore('theme-v2', value);
  }, []);
  const setLang = useCallback((value) => {
    setLangState(value);
    writeStore('lang', value);
  }, []);
  const setCollapsed = useCallback((value) => {
    setCollapsedState((prev) => {
      const next = typeof value === 'function' ? value(prev) : value;
      writeStore('sidebar-collapsed', next);
      return next;
    });
  }, []);

  const t = useCallback(
    (key, vars) => {
      let text = lang === 'en' ? EN[key] ?? key : key;
      if (vars) for (const [k, v] of Object.entries(vars)) text = text.split(`{${k}}`).join(String(v));
      return text;
    },
    [lang],
  );

  const value = useMemo(
    () => ({ themePref, theme: resolved, setTheme, lang, setLang, t, collapsed, setCollapsed }),
    [themePref, resolved, setTheme, lang, setLang, t, collapsed, setCollapsed],
  );
  return <PrefsCtx.Provider value={value}>{children}</PrefsCtx.Provider>;
}

export function usePrefs() {
  return useContext(PrefsCtx);
}

/** Hàm dịch: t('Bảng tin') -> 'Feed' khi lang = en. */
export function useT() {
  return useContext(PrefsCtx).t;
}
