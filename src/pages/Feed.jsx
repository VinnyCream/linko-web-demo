import { useEffect, useMemo, useRef, useState } from 'react';
import Avatar, { AvatarStack } from '../components/Avatar.jsx';
import Icon from '../components/Icon.jsx';
import { Button, IconButton } from '../components/Button.jsx';
import { Tabs } from '../components/Form.jsx';
import Menu from '../components/Menu.jsx';
import RichText from '../components/RichText.jsx';
import { Banner, EmptyState, LoadingNote, Skeleton } from '../components/Feedback.jsx';
import { useToast } from '../components/Toast.jsx';
import { Link, useNavigate } from '../lib/router.jsx';
import { usePrefs, useT } from '../state/prefs.jsx';
import { useSession } from '../auth/session.jsx';
import { useSocial } from '../state/social.jsx';
import { usePeople } from '../state/people.jsx';
import { useQuery } from '../hooks/useQuery.js';
import { api } from '../api/endpoints.js';
import { formatDateTime, relTime } from '../lib/format.js';
import { readStore, writeStore } from '../lib/storage.js';

const AUDIENCE = { company: ['globe', 'Toàn công ty'], dept: ['building', 'Phòng ban'], project: ['folder', 'Dự án'] };

export function openCompose() {
  window.dispatchEvent(new CustomEvent('linko:compose'));
}

function Greeting() {
  const t = useT();
  const { lang } = usePrefs();
  const { me, subject } = useSession();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  const h = now.getHours();
  const part = h < 11 ? 'Chào buổi sáng' : h < 13 ? 'Chào buổi trưa' : h < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
  const first = (me?.full_name || subject || '').trim().split(/\s+/).pop();
  const date = now.toLocaleDateString(lang === 'en' ? 'en-US' : 'vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  const time = now.toLocaleTimeString(lang === 'en' ? 'en-US' : 'vi-VN', { hour: '2-digit', minute: '2-digit' });
  return (
    <div className="greeting">
      <h1 className="t-h2">{t(part)}, {first}.</h1>
      <p className="muted">
        <time dateTime={now.toISOString()}>{date}, {time}</time>
      </p>
    </div>
  );
}

function ComposerTrigger() {
  const t = useT();
  const { me, subject } = useSession();
  const name = me?.full_name || subject || '';
  return (
    <div className="composer-trigger">
      <Avatar id={me?.employee_id} name={name} size="md" />
      <button type="button" className="composer-fake" onClick={openCompose}>
        {t('Chia sẻ cập nhật với đồng nghiệp...')}
      </button>
      <IconButton icon="image" label={t('Thêm ảnh (sắp có)')} disabled />
    </div>
  );
}

export function FeedPost({ post, onDelete }) {
  const t = useT();
  const { lang } = usePrefs();
  const social = useSocial();
  const toast = useToast();
  const { me } = useSession();
  const [commenting, setCommenting] = useState(false);
  const [comment, setComment] = useState('');
  const [likeKey, setLikeKey] = useState(0);
  const [saveKey, setSaveKey] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const editRef = useRef(null);
  const [aud, audLabel] = AUDIENCE[post.audience] || AUDIENCE.company;
  const mine = post.mine || (me && post.authorId === me.employee_id);

  const send = (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    social.addComment(post.id, comment.trim());
    setComment('');
  };

  const startEdit = () => {
    setDraft(post.text || '');
    setEditing(true);
    setTimeout(() => {
      const el = editRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    }, 0);
  };
  const saveEdit = () => {
    const text = draft.trim();
    if (!text) return;
    if (text !== post.text) {
      social.editPost(post.id, text);
      toast.show({ tone: 'success', title: t('Đã cập nhật bài viết') });
    }
    setEditing(false);
  };
  const removeComment = (c) => {
    const index = post.comments.findIndex((x) => x.id === c.id);
    social.deleteComment(post.id, c.id);
    toast.show({ tone: 'info', title: t('Đã xoá bình luận'), action: t('Hoàn tác'), onAction: () => social.restoreComment(post.id, c, index) });
  };

  return (
    <article className="post" aria-labelledby={`post-${post.id}`}>
      <header className="post-head">
        <Avatar id={post.authorId} name={post.authorName} size="md" />
        <div className="post-who">
          <Link id={`post-${post.id}`} to={`/people/${post.authorId}`} className="post-author">
            {post.authorName}
          </Link>
          <p className="post-meta">
            {post.authorTitle && <span className="truncate">{post.authorTitle}</span>}
            <time dateTime={post.time} title={formatDateTime(post.time, lang)}>
              {relTime(post.time, lang)}
            </time>
            {post.edited && <span className="post-edited" title={formatDateTime(post.edited, lang)}>{t('đã sửa')}</span>}
            <span className="post-aud" title={t(audLabel)}>
              <Icon name={aud} size={11} label={t(audLabel)} />
            </span>
          </p>
        </div>
        <Menu
          label={t('Tuỳ chọn bài viết')}
          trigger={(props) => (
            <button type="button" className="ibtn ibtn-ghost ibtn-sm" aria-label={t('Tuỳ chọn bài viết')} {...props}>
              <Icon name="ellipsis" size={16} />
            </button>
          )}
          items={[
            {
              id: 'copy',
              label: t('Sao chép nội dung'),
              icon: 'copy',
              onSelect: () => navigator.clipboard?.writeText(post.text || '').then(() => toast.show({ tone: 'success', title: t('Đã sao chép') }), () => {}),
            },
            { id: 'save', label: post.saved ? t('Bỏ lưu') : t('Lưu bài viết'), icon: 'bookmark', onSelect: () => social.toggleSave(post.id) },
            mine && !post.event && { id: 'edit', label: t('Sửa bài viết'), icon: 'pen', onSelect: startEdit },
            mine && { divider: true },
            mine && { id: 'del', label: t('Xoá bài viết'), icon: 'trash-can', tone: 'danger', onSelect: onDelete },
          ]}
        />
      </header>

      {post.event ? (
        <div className="post-event">
          <AvatarStack people={[{ id: post.event.aId, name: post.event.aName }, { id: post.event.bId, name: post.event.bName }]} size="md" />
          <p>
            <Link to={`/people/${post.event.aId}`}>{post.event.aName}</Link> {t('và')} <Link to={`/people/${post.event.bId}`}>{post.event.bName}</Link>{' '}
            {t('trở thành đồng đội trong dự án')} <Link to={`/projects/${post.event.projectId}`}>{post.event.projectName}</Link>.
          </p>
          <span className="post-event-tag">
            <Icon name="bolt" size={11} />
            {t('Tự động từ dự án chung')}
          </span>
        </div>
      ) : editing ? (
        <form
          className="post-edit"
          onSubmit={(e) => {
            e.preventDefault();
            saveEdit();
          }}
        >
          <textarea
            ref={editRef}
            className="input textarea"
            rows={3}
            maxLength={2000}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label={t('Nội dung bài viết')}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setEditing(false);
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveEdit();
            }}
          />
          <div className="post-edit-bar">
            <span className="muted t-caption">{t('Ctrl Enter để lưu, Esc để huỷ')}</span>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              {t('Huỷ')}
            </Button>
            <Button size="sm" variant="primary" type="submit" disabled={!draft.trim()}>
              {t('Lưu')}
            </Button>
          </div>
        </form>
      ) : (
        <p className="post-text">
          <RichText text={post.text} />
        </p>
      )}

      <footer className="post-actions">
        <button
          type="button"
          className={`post-act${post.liked ? ' is-on' : ''}`}
          aria-pressed={post.liked}
          onClick={() => {
            social.toggleLike(post.id);
            setLikeKey((k) => k + 1);
          }}
        >
          <Icon name="thumbs-up" filled={post.liked} size={16} anim={post.liked ? 'beat' : undefined} animKey={likeKey} />
          <span className="post-act-label">{t('Thích')}</span>
          {post.likes > 0 && <span className="lk-num post-count">{post.likes}</span>}
        </button>
        <button type="button" className={`post-act${commenting ? ' is-on' : ''}`} aria-expanded={commenting} onClick={() => setCommenting((c) => !c)}>
          <Icon name="comment" size={16} filled={commenting} />
          <span className="post-act-label">{t('Bình luận')}</span>
          {post.comments.length > 0 && <span className="lk-num post-count">{post.comments.length}</span>}
        </button>
        <button
          type="button"
          className={`post-act post-act-end${post.saved ? ' is-on' : ''}`}
          aria-pressed={post.saved}
          onClick={() => {
            social.toggleSave(post.id);
            setSaveKey((k) => k + 1);
          }}
        >
          <Icon name="bookmark" filled={post.saved} size={16} anim={post.saved ? 'bounce' : undefined} animKey={saveKey} />
          <span className="post-act-label">{post.saved ? t('Đã lưu') : t('Lưu')}</span>
        </button>
      </footer>

      {(commenting || post.comments.length > 0) && (
        <div className="comments">
          {post.comments.map((c) => (
            <div key={c.id} className="comment">
              <Avatar id={c.authorId} name={c.authorName} size="sm" presence={false} />
              <div className="comment-bubble">
                <Link to={`/people/${c.authorId}`} className="t-label">{c.authorName}</Link>
                <p>
                  <RichText text={c.text} />
                </p>
                <time className="muted t-caption" dateTime={c.time} title={formatDateTime(c.time, lang)}>
                  {relTime(c.time, lang)}
                </time>
              </div>
              {me && c.authorId === me.employee_id && (
                <IconButton icon="trash-can" label={t('Xoá bình luận')} size="sm" variant="ghost" className="comment-del" onClick={() => removeComment(c)} />
              )}
            </div>
          ))}
          {commenting && (
            <form className="comment-form" onSubmit={send}>
              <Avatar id={me?.employee_id} name={me?.full_name || ''} size="sm" presence={false} decorative />
              <input
                className="input"
                placeholder={t('Viết bình luận...')}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                aria-label={t('Bình luận của bạn')}
                maxLength={500}
                autoFocus
              />
              <IconButton type="submit" icon="paper-plane" label={t('Gửi bình luận')} disabled={!comment.trim()} variant="soft" />
            </form>
          )}
        </div>
      )}
    </article>
  );
}

function SideOnline() {
  const t = useT();
  const { people, presenceOf } = usePeople();
  const { me } = useSession();
  const online = people.filter((p) => p.status === 'ACTIVE' && p.employee_id !== me?.employee_id && presenceOf(p.employee_id) === 'online');
  return (
    <section className="side-block" aria-labelledby="side-online">
      <div className="side-head">
        <h2 id="side-online" className="t-h4">{t('Đang trực tuyến')}</h2>
        <span className="presence-count lk-num">
          <span className="presence presence-online static" aria-hidden="true" />
          {online.length}
        </span>
      </div>
      <ul className="mini-list">
        {online.slice(0, 6).map((p) => (
          <li key={p.employee_id}>
            <Link to={`/people/${p.employee_id}`} className="mini-row">
              <Avatar id={p.employee_id} name={p.full_name} size="sm" />
              <span className="mini-text">
                <span className="t-label truncate">{p.full_name}</span>
                <span className="muted t-caption truncate">{p.title}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {online.length > 6 && (
        <Link to="/directory?presence=online" className="side-more">
          {t('Xem tất cả {n} người', { n: online.length })}
        </Link>
      )}
    </section>
  );
}

function SidePath() {
  const t = useT();
  const { me } = useSession();
  const target = 1;
  const enabled = Boolean(me && me.employee_id !== target);
  const q = useQuery(enabled ? `path:${me?.employee_id}:${target}` : null, () => api.shortestPath({ source_id: me.employee_id, target_id: target, max_hops: 6, include_projects: false }), { enabled });
  if (!enabled) return null;
  return (
    <section className="side-block" aria-labelledby="side-path">
      <h2 id="side-path" className="t-h4">{t('Bạn cách Ban Giám đốc bao xa?')}</h2>
      {q.loading ? (
        <>
          <Skeleton lines={2} />
          <LoadingNote slow={q.slow} compact lines={['Đang dò đường trên đồ thị...', 'Đồ thị lớn, chờ thêm chút nhé.']} />
        </>
      ) : q.data?.found ? (
        <>
          <p className="side-big lk-num">
            {q.data.path_length} <span>{t('bậc')}</span>
          </p>
          <AvatarStack people={[q.data.steps[0], ...q.data.steps].map((s, i) => (i === 0 ? { id: s.from_id, name: s.from_name } : { id: s.to_id, name: s.to_name }))} size="sm" max={6} />
          <Link to={`/path?from=${me.employee_id}&to=${target}`} className="side-more">
            {t('Xem từng bước')}
          </Link>
        </>
      ) : (
        <p className="muted t-ui">{t('Chưa tìm thấy đường trong 6 bậc. Kết nối thêm đồng nghiệp để rút ngắn khoảng cách.')}</p>
      )}
    </section>
  );
}

function SideTeammates() {
  const t = useT();
  const { me } = useSession();
  const q = useQuery(me ? `teammates:${me.employee_id}` : null, () => api.employeeTeammates(me.employee_id), { enabled: Boolean(me) });
  if (!me) return null;
  return (
    <section className="side-block" aria-labelledby="side-tm">
      <h2 id="side-tm" className="t-h4">{t('Đồng đội trong dự án')}</h2>
      {q.loading ? (
        <Skeleton variant="row" />
      ) : !q.data?.length ? (
        <p className="muted t-ui">{t('Bạn chưa ở dự án nào. Khi được thêm vào dự án, đồng đội sẽ xuất hiện ở đây.')}</p>
      ) : (
        <>
          <AvatarStack people={q.data.map((p) => ({ id: p.employee_id, name: p.full_name }))} max={7} size="sm" />
          <Link to="/connections?type=TEAMMATE" className="side-more">
            {t('{n} đồng đội', { n: q.data.length })}
          </Link>
        </>
      )}
    </section>
  );
}

const PAGE = 5;

export default function Feed() {
  const t = useT();
  const social = useSocial();
  const toast = useToast();
  const navigate = useNavigate();
  const [tab, setTab] = useState('all');
  const [shown, setShown] = useState(PAGE);
  const [loadingMore, setLoadingMore] = useState(false);
  const [noticeHidden, setNoticeHidden] = useState(() => readStore('feed-notice-hidden', false));
  const sentinel = useRef(null);

  useEffect(() => {
    document.title = `${t('Bảng tin')} | Linko`;
  }, [t]);

  const posts = useMemo(() => {
    if (tab === 'saved') return social.posts.filter((p) => p.saved);
    if (tab === 'project') return social.posts.filter((p) => p.audience === 'project' || p.event);
    return social.posts;
  }, [social.posts, tab]);
  const visible = posts.slice(0, shown);
  const hasMore = shown < posts.length;

  const loadMore = () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    setTimeout(() => {
      setShown((s) => s + PAGE);
      setLoadingMore(false);
    }, 600);
  };

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasMore) return undefined;
    const io = new IntersectionObserver((entries) => entries[0].isIntersecting && loadMore(), { rootMargin: '200px' });
    io.observe(node);
    return () => io.disconnect();
  });

  const remove = (post) => {
    const index = social.posts.findIndex((p) => p.id === post.id);
    social.deletePost(post.id);
    toast.show({ tone: 'info', title: t('Đã xoá bài viết'), action: t('Hoàn tác'), onAction: () => social.restorePost(post, index) });
  };

  return (
    <div className="page feed-layout">
      <div className="feed-col">
        <Greeting />
        <ComposerTrigger />
        {!noticeHidden && (
          <Banner
            tone="info"
            title={t('Bảng tin đang chạy cục bộ')}
            onClose={() => {
              setNoticeHidden(true);
              writeStore('feed-notice-hidden', true);
            }}
          >
            {t('Backend V7 chưa có API bảng tin, tin nhắn và thông báo, nên bài viết đang lưu trên trình duyệt này. Tên người, dự án và đồng đội là dữ liệu thật từ Oracle.')}
          </Banner>
        )}
        <Tabs
          label={t('Lọc bảng tin')}
          value={tab}
          onChange={(v) => {
            setTab(v);
            setShown(PAGE);
          }}
          tabs={[
            { value: 'all', label: t('Mới nhất'), icon: 'newspaper' },
            { value: 'project', label: t('Dự án của tôi'), icon: 'folder' },
            { value: 'saved', label: t('Đã lưu'), icon: 'bookmark', count: social.posts.filter((p) => p.saved).length },
          ]}
        />
        <div className="feed-list" aria-busy={!social.ready}>
          {!social.ready ? (
            <>
              <Skeleton variant="post" />
              <Skeleton variant="post" />
              <Skeleton variant="post" />
            </>
          ) : posts.length === 0 ? (
            tab === 'saved' ? (
              <EmptyState icon="bookmark" title={t('Bạn chưa lưu bài viết nào')} description={t('Bấm Lưu ở một bài viết để đọc lại sau.')} action={t('Xem bài mới nhất')} onAction={() => setTab('all')} />
            ) : (
              <EmptyState mascot title={t('Bảng tin còn trống')} description={t('Kết nối với đồng đội để thấy cập nhật của họ, hoặc đăng bài đầu tiên.')} action={t('Tìm đồng nghiệp')} onAction={() => navigate('/directory')} secondary={t('Tạo bài viết')} onSecondary={openCompose} />
            )
          ) : (
            visible.map((post) => <FeedPost key={post.id} post={post} onDelete={() => remove(post)} />)
          )}
          {loadingMore && <Skeleton variant="post" />}
          {hasMore && !loadingMore && (
            <div ref={sentinel} className="feed-more">
              <Button variant="ghost" onClick={loadMore} iconStart="chevron-down">
                {t('Xem bài cũ hơn')}
              </Button>
            </div>
          )}
          {!hasMore && posts.length > PAGE && <p className="feed-end">{t('Bạn đã xem hết bài viết.')}</p>}
        </div>
      </div>
      <aside className="feed-side" aria-label={t('Gợi ý')}>
        <SideOnline />
        <SidePath />
        <SideTeammates />
      </aside>
    </div>
  );
}
