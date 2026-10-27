import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from '../auth/session.jsx';
import { usePeople } from './people.jsx';
import { api } from '../api/endpoints.js';
import { readStore, writeStore } from '../lib/storage.js';
import { hashIndex } from '../lib/format.js';

// Bảng tin, tin nhắn và thông báo.
// Backend V7 chưa có các API này (ngoài phạm vi 7 bảng Oracle), nên dữ liệu được giữ trên trình duyệt
// và gieo sẵn từ dữ liệu thật của danh bạ (đồng đội, dự án). Khi backend thêm endpoint, chỉ cần thay
// các hàm trong file này; giao diện giữ nguyên. Xem API_CONTRACT.md.
const SocialCtx = createContext(null);
const HOUR = 3_600_000;

function pick(list, seed) {
  return list.length ? list[hashIndex(seed, list.length)] : null;
}

function buildSeed({ me, people, projects, profile }) {
  const now = Date.now();
  const active = people.filter((p) => p.status === 'ACTIVE' && p.employee_id !== me?.employee_id);
  const teammates = (profile?.teammates || []).filter((x) => x.employee_id !== me?.employee_id);
  const myProjects = profile?.projects || [];
  const close = teammates.length ? teammates.map((x) => people.find((p) => p.employee_id === x.employee_id)).filter(Boolean) : active.slice(0, 12);
  const someone = (seed) => pick(close.length ? close : active, seed) || active[0];
  const anyone = (seed) => pick(active, seed);
  const proj = (seed) => pick(myProjects.length ? myProjects : projects, seed);
  const p1 = proj('p1');
  const p2 = proj('p2b');
  const pName = (p) => p?.project_name || 'Linko';
  const posts = [];
  let id = 1;
  const add = (author, text, hoursAgo, extra = {}) => {
    if (!author) return;
    posts.push({
      id: `seed-${id++}`, authorId: author.employee_id, authorName: author.full_name, authorTitle: author.title,
      text, audience: extra.audience || 'company', time: new Date(now - hoursAgo * HOUR).toISOString(),
      likes: extra.likes ?? hashIndex(text, 18) + 2, liked: false, saved: false, comments: extra.comments || [], event: extra.event || null,
    });
  };
  const a = someone('a1');
  const b = anyone('b7');
  const c = someone('c3');
  const d = anyone('d9');
  add(a, `Bản demo sprint này của #[${pName(p1)}] đã chạy ổn trên môi trường staging. Cảm ơn @[${c?.full_name}] đã gỡ lỗi pool kết nối tới Oracle tối qua.`, 1.2, {
    audience: 'project',
    comments: c ? [{ id: 'c1', authorId: c.employee_id, authorName: c.full_name, text: 'Lỗi do timeout của listener thôi, giờ đã ổn định rồi.', time: new Date(now - 0.9 * HOUR).toISOString() }] : [],
  });
  if (teammates.length && me) {
    const tm = teammates[0];
    add(people.find((p) => p.employee_id === tm.employee_id), '', 3.5, {
      event: { aId: me.employee_id, aName: me.full_name, bId: tm.employee_id, bName: tm.full_name, projectId: tm.project_id, projectName: tm.project_name },
      likes: 6,
    });
  }
  add(b, 'Phòng Nhân sự mở đăng ký buổi chia sẻ "Truy vấn đồ thị với SQL Property Graph" vào chiều thứ Năm. Ai muốn tham gia thì bình luận bên dưới để mình giữ chỗ nhé.', 5, {
    comments: d ? [{ id: 'c2', authorId: d.employee_id, authorName: d.full_name, text: 'Cho mình một chỗ với.', time: new Date(now - 4.5 * HOUR).toISOString() }] : [],
  });
  add(d, `Team đang cần thêm một người review luồng đăng nhập cho #[${pName(p2)}]. Ai có 30 phút chiều nay thì nhắn mình.`, 9, { audience: 'dept' });
  add(someone('e5'), 'Ghi chú nhanh sau buổi retro: giữ daily 15 phút, dời demo sang thứ Sáu, và mỗi PR cần ít nhất một người review khác phòng.', 22);
  add(anyone('f2'), 'Chào mừng các bạn thực tập mới tuần này. Nếu cần tìm người hướng dẫn, mở mục Tìm đường kết nối và xem ai gần bạn nhất trong mạng lưới.', 30, { likes: 24 });
  add(anyone('g8'), 'Bảng tổng hợp liên kết liên phòng tháng này cho thấy Chi nhánh Đà Nẵng làm việc với Phòng Công nghệ nhiều gấp đôi tháng trước. Một tín hiệu tốt cho dự án chuyển đổi số.', 52);
  add(anyone('h1'), 'Nhắc nhẹ: cập nhật ảnh đại diện trong Cài đặt để đồng nghiệp dễ nhận ra bạn hơn trong các cuộc họp trực tuyến.', 75, { likes: 11 });
  add(anyone('i4'), `Tài liệu bàn giao của #[${pName(proj('p3'))}] đã được cập nhật. Phần sơ đồ kiến trúc đã thêm luồng đồng bộ dữ liệu giữa các chi nhánh.`, 98);
  add(anyone('j6'), 'Cảm ơn mọi người đã hỗ trợ đợt kiểm tra bảo mật vừa rồi. Không phát hiện lỗi nghiêm trọng nào.', 130, { likes: 31 });
  add(anyone('k2'), 'Ai có kinh nghiệm tối ưu truy vấn nhiều bậc trong Oracle 23ai cho mình xin 15 phút trao đổi tuần này nhé.', 160);

  const convPeople = [...new Map([...close, ...active].map((p) => [p.employee_id, p])).values()].slice(0, 5);
  const lines = [
    ['them', 'Chào bạn, chiều nay mình họp nhanh 10 phút về tiến độ được không?'],
    ['me', 'Được, 15 giờ nhé.'],
    ['them', 'Ok, mình gửi link họp trong nhóm.'],
  ];
  const conversations = convPeople.map((p, i) => ({
    id: `conv-${p.employee_id}`, personId: p.employee_id, personName: p.full_name, personTitle: p.title,
    unread: i < 2 ? 1 : 0,
    messages: (i === 0 ? lines : i === 1 ? [['them', 'Bạn xem giúp mình tài liệu đặc tả API mới chưa?']] : [['me', 'Cảm ơn bạn đã hỗ trợ hôm trước.'], ['them', 'Không có gì, cần gì cứ nhắn mình.']]).map(([from, text], j, arr) => ({
      id: `m-${p.employee_id}-${j}`, from, text, time: new Date(now - (i * 7 + (arr.length - j)) * 0.35 * HOUR).toISOString(), status: 'seen',
    })),
  }));

  const n1 = someone('n1');
  const n2 = anyone('n2');
  const n3 = someone('n3');
  const notifications = [
    teammates[0] && { id: 'n-1', kind: 'teammate', actorId: teammates[0].employee_id, actorName: teammates[0].full_name, projectId: teammates[0].project_id, projectName: teammates[0].project_name, time: new Date(now - 3.5 * HOUR).toISOString(), unread: true },
    n1 && { id: 'n-2', kind: 'mention', actorId: n1.employee_id, actorName: n1.full_name, text: 'đã nhắc tới bạn trong một bài viết', time: new Date(now - 1.2 * HOUR).toISOString(), unread: true, link: '/' },
    n2 && { id: 'n-3', kind: 'comment', actorId: n2.employee_id, actorName: n2.full_name, text: 'đã bình luận về bài viết bạn theo dõi', time: new Date(now - 4.5 * HOUR).toISOString(), unread: true, link: '/' },
    myProjects[0] && { id: 'n-4', kind: 'project', actorId: n3?.employee_id, actorName: n3?.full_name, projectId: myProjects[0].project_id, projectName: myProjects[0].project_name, role: myProjects[0].role, time: new Date(now - 26 * HOUR).toISOString(), unread: false },
    { id: 'n-5', kind: 'system', text: 'Chào mừng bạn tới Linko. Cập nhật ảnh đại diện để đồng nghiệp dễ nhận ra bạn.', time: new Date(now - 48 * HOUR).toISOString(), unread: false, link: '/settings' },
  ].filter(Boolean);
  return { posts, conversations, notifications, saved: [], version: 1 };
}

export function SocialProvider({ children }) {
  const session = useSession();
  const { people, projects } = usePeople();
  const key = session.status === 'ready' ? `social:${session.mode}:${session.subject}` : null;
  const [state, setState] = useState(null);
  const [pingKey, setPingKey] = useState(0);
  const [typing, setTyping] = useState({});
  const seeding = useRef(false);

  useEffect(() => {
    if (!key) {
      setState(null);
      return;
    }
    const saved = readStore(key);
    if (saved?.version === 1) setState(saved);
    else setState(null);
    seeding.current = false;
  }, [key]);

  useEffect(() => {
    if (!key || state || seeding.current || !people.length) return;
    seeding.current = true;
    const me = session.me;
    (me ? api.profile(me.employee_id).catch(() => null) : Promise.resolve(null)).then((profile) => {
      const seeded = buildSeed({ me, people, projects, profile });
      writeStore(key, seeded);
      setState(seeded);
    });
  }, [key, state, people, projects, session.me]);

  const update = useCallback(
    (fn) => {
      setState((prev) => {
        if (!prev) return prev;
        const next = fn(prev);
        writeStore(key, next);
        return next;
      });
    },
    [key],
  );

  // Một thông báo mới xuất hiện sau ít phút trong phiên demo: chuông rung và ping.
  useEffect(() => {
    if (!state || session.mode !== 'demo') return undefined;
    const timer = setTimeout(() => {
      const actor = people.filter((p) => p.status === 'ACTIVE')[hashIndex(String(Date.now()), Math.max(1, people.length))];
      if (!actor) return;
      update((s) => ({
        ...s,
        notifications: [{ id: `n-live-${Date.now()}`, kind: 'like', actorId: actor.employee_id, actorName: actor.full_name, text: 'đã thích bài viết của bạn', time: new Date().toISOString(), unread: true, link: '/' }, ...s.notifications],
      }));
      setPingKey((k) => k + 1);
    }, 75_000);
    return () => clearTimeout(timer);
  }, [Boolean(state), session.mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const me = session.me;
  const actions = useMemo(
    () => ({
      addPost: (text, audience) =>
        update((s) => ({
          ...s,
          posts: [{ id: `p-${Date.now()}`, authorId: me?.employee_id, authorName: me?.full_name || session.subject, authorTitle: me?.title, text, audience, time: new Date().toISOString(), likes: 0, liked: false, saved: false, comments: [], mine: true }, ...s.posts],
        })),
      deletePost: (postId) => update((s) => ({ ...s, posts: s.posts.filter((p) => p.id !== postId) })),
      restorePost: (post, index) => update((s) => {
        const posts = [...s.posts];
        posts.splice(index, 0, post);
        return { ...s, posts };
      }),
      editPost: (postId, text, audience) =>
        update((s) => ({ ...s, posts: s.posts.map((p) => (p.id === postId ? { ...p, text, audience: audience || p.audience, edited: new Date().toISOString() } : p)) })),
      deleteComment: (postId, commentId) =>
        update((s) => ({ ...s, posts: s.posts.map((p) => (p.id === postId ? { ...p, comments: p.comments.filter((c) => c.id !== commentId) } : p)) })),
      restoreComment: (postId, comment, index) =>
        update((s) => ({
          ...s,
          posts: s.posts.map((p) => {
            if (p.id !== postId) return p;
            const comments = [...p.comments];
            comments.splice(index, 0, comment);
            return { ...p, comments };
          }),
        })),
      deleteConversation: (cid) => update((s) => ({ ...s, conversations: s.conversations.filter((c) => c.id !== cid) })),
      restoreConversation: (conv, index) =>
        update((s) => {
          const conversations = [...s.conversations];
          conversations.splice(index, 0, conv);
          return { ...s, conversations };
        }),
      deleteMessage: (cid, mid) =>
        update((s) => ({ ...s, conversations: s.conversations.map((c) => (c.id === cid ? { ...c, messages: c.messages.filter((m) => m.id !== mid) } : c)) })),
      restoreNotification: (n, index) =>
        update((s) => {
          const notifications = [...s.notifications];
          notifications.splice(index, 0, n);
          return { ...s, notifications };
        }),
      clearReadNotifications: () => update((s) => ({ ...s, notifications: s.notifications.filter((n) => n.unread) })),
      toggleLike: (postId) => update((s) => ({ ...s, posts: s.posts.map((p) => (p.id === postId ? { ...p, liked: !p.liked, likes: p.likes + (p.liked ? -1 : 1) } : p)) })),
      toggleSave: (postId) => update((s) => ({ ...s, posts: s.posts.map((p) => (p.id === postId ? { ...p, saved: !p.saved } : p)) })),
      addComment: (postId, text) =>
        update((s) => ({
          ...s,
          posts: s.posts.map((p) => (p.id === postId ? { ...p, comments: [...p.comments, { id: `c-${Date.now()}`, authorId: me?.employee_id, authorName: me?.full_name || session.subject, text, time: new Date().toISOString() }] } : p)),
        })),
      markRead: (nid) => update((s) => ({ ...s, notifications: s.notifications.map((n) => (n.id === nid ? { ...n, unread: false } : n)) })),
      markAllRead: () => update((s) => ({ ...s, notifications: s.notifications.map((n) => ({ ...n, unread: false })) })),
      removeNotification: (nid) => update((s) => ({ ...s, notifications: s.notifications.filter((n) => n.id !== nid) })),
      openConversation: (person) =>
        update((s) => {
          if (s.conversations.some((c) => c.personId === person.employee_id)) {
            return { ...s, conversations: s.conversations.map((c) => (c.personId === person.employee_id ? { ...c, unread: 0 } : c)) };
          }
          return { ...s, conversations: [{ id: `conv-${person.employee_id}`, personId: person.employee_id, personName: person.full_name, personTitle: person.title, unread: 0, messages: [] }, ...s.conversations] };
        }),
      readConversation: (cid) => update((s) => ({ ...s, conversations: s.conversations.map((c) => (c.id === cid ? { ...c, unread: 0 } : c)) })),
      sendMessage: (cid, text) => {
        update((s) => ({
          ...s,
          conversations: s.conversations.map((c) => (c.id === cid ? { ...c, messages: [...c.messages, { id: `m-${Date.now()}`, from: 'me', text, time: new Date().toISOString(), status: 'sent' }] } : c)),
        }));
        if (session.mode !== 'demo') return;
        // Bản demo: đồng nghiệp "đang nhập" rồi trả lời để thấy luồng hội thoại.
        setTimeout(() => setTyping((x) => ({ ...x, [cid]: true })), 900);
        setTimeout(() => {
          setTyping((x) => ({ ...x, [cid]: false }));
          const replies = ['Ok, mình nhận được rồi.', 'Cảm ơn bạn nhé.', 'Để mình kiểm tra rồi báo lại.', 'Chuẩn, làm vậy đi.'];
          update((s) => ({
            ...s,
            conversations: s.conversations.map((c) => (c.id === cid ? { ...c, messages: [...c.messages.map((m) => ({ ...m, status: 'seen' })), { id: `m-${Date.now()}`, from: 'them', text: replies[hashIndex(text, replies.length)], time: new Date().toISOString(), status: 'seen' }] } : c)),
          }));
        }, 3200);
      },
    }),
    [update, me, session.subject, session.mode],
  );

  const value = useMemo(() => {
    const s = state || { posts: [], conversations: [], notifications: [] };
    return {
      ready: Boolean(state),
      ...s,
      ...actions,
      typing,
      pingKey,
      unreadNotifications: s.notifications.filter((n) => n.unread).length,
      unreadMessages: s.conversations.reduce((sum, c) => sum + (c.unread || 0), 0),
    };
  }, [state, actions, typing, pingKey]);
  return <SocialCtx.Provider value={value}>{children}</SocialCtx.Provider>;
}

export function useSocial() {
  return useContext(SocialCtx);
}
