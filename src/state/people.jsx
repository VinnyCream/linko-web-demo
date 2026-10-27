import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { readStore, writeStore } from '../lib/storage.js';
import { hashIndex } from '../lib/format.js';
import { useSession } from '../auth/session.jsx';
import { api } from '../api/endpoints.js';
import { useQuery } from '../hooks/useQuery.js';

// Ảnh đại diện và trạng thái trực tuyến.
// Backend V7 chưa có endpoint ảnh và presence, nên:
// - ảnh đại diện lưu trên trình duyệt (đã thu nhỏ 256px) cho tới khi có PUT /api/employees/{id}/avatar;
// - presence mô phỏng ổn định theo giờ cho đồng nghiệp, còn bạn thì theo hoạt động thật (rảnh 5 phút là "vắng").
// Xem API_CONTRACT.md để biết endpoint đề xuất.
const PeopleCtx = createContext(null);
const AVATAR_KEY = 'avatars';

export function PeopleProvider({ children }) {
  const session = useSession();
  const [avatars, setAvatars] = useState(() => readStore(AVATAR_KEY, {}));
  const [tick, setTick] = useState(0);
  const [idle, setIdle] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine !== false);
  const ready = session.status === 'ready';

  // Danh bạ dùng chung cho tìm kiếm toàn cục, gợi ý, tên trong bảng tin
  const people = useQuery(ready ? 'employees:all' : null, () => api.employees({ status: 'ALL', limit: 500 }), { enabled: ready });
  const departments = useQuery(ready ? 'departments' : null, () => api.departments(), { enabled: ready });
  const projects = useQuery(ready ? 'projects' : null, () => api.projects(), { enabled: ready });

  useEffect(() => {
    const id = setInterval(() => setTick((x) => x + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  useEffect(() => {
    let timer;
    const reset = () => {
      setIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), 5 * 60_000);
    };
    reset();
    const events = ['pointerdown', 'keydown', 'scroll', 'pointermove'];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, []);

  const setAvatar = useCallback((id, dataUrl) => {
    setAvatars((prev) => {
      const next = { ...prev };
      if (dataUrl) next[id] = dataUrl;
      else delete next[id];
      writeStore(AVATAR_KEY, next);
      return next;
    });
  }, []);

  const meId = session.me?.employee_id;
  const presenceOf = useCallback(
    (id) => {
      if (!id) return undefined;
      if (Number(id) === Number(meId)) return !online ? 'offline' : idle ? 'away' : 'online';
      const hour = Math.floor(Date.now() / 3_600_000);
      const roll = hashIndex(`${id}:${hour}:${Math.floor(tick / 15)}`, 10);
      return roll < 4 ? 'online' : roll < 5 ? 'away' : 'offline';
    },
    [meId, online, idle, tick],
  );

  const byId = useMemo(() => {
    const map = new Map();
    (people.data || []).forEach((p) => map.set(p.employee_id, p));
    return map;
  }, [people.data]);

  const value = useMemo(
    () => ({
      avatars, setAvatar, avatarOf: (id) => avatars[id], presenceOf, online, idle,
      people: people.data || [], peopleLoading: people.loading, byId,
      departments: departments.data || [], projects: projects.data || [],
      refreshPeople: people.refetch,
    }),
    [avatars, setAvatar, presenceOf, online, idle, people.data, people.loading, byId, departments.data, projects.data, people.refetch],
  );
  return <PeopleCtx.Provider value={value}>{children}</PeopleCtx.Provider>;
}

export function usePeople() {
  return useContext(PeopleCtx);
}

/** Thu nhỏ ảnh về hình vuông 256px (cắt giữa), trả về data URL JPEG. */
export function resizeImage(file, size = 256) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) {
      reject(new Error('type'));
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      reject(new Error('size'));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.86));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('decode'));
    };
    img.src = url;
  });
}
