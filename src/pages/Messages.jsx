import { useEffect, useMemo, useRef, useState } from 'react';
import Avatar from '../components/Avatar.jsx';
import Icon from '../components/Icon.jsx';
import { Button, IconButton } from '../components/Button.jsx';
import { EmptyState, SkeletonList } from '../components/Feedback.jsx';
import { PersonPicker } from '../components/Form.jsx';
import { Dialog } from '../components/Dialog.jsx';
import Menu from '../components/Menu.jsx';
import { useToast } from '../components/Toast.jsx';
import { Breadcrumbs } from '../components/PageHeader.jsx';
import { Link, useLocation, useNavigate } from '../lib/router.jsx';
import { usePrefs, useT } from '../state/prefs.jsx';
import { useSocial } from '../state/social.jsx';
import { usePeople } from '../state/people.jsx';
import { fold, formatDateTime, relTime } from '../lib/format.js';

const PRESENCE_TEXT = { online: 'Đang trực tuyến', away: 'Tạm vắng', offline: 'Ngoại tuyến' };

// Tin nhắn: danh sách hội thoại và khung chat. Điện thoại: mở hội thoại thì ẩn danh sách (master/detail).
export default function Messages() {
  const t = useT();
  const { lang } = usePrefs();
  const social = useSocial();
  const { presenceOf, byId } = usePeople();
  const location = useLocation();
  const navigate = useNavigate();
  const activeId = location.query.get('c');
  const withPerson = location.query.get('to');
  const [filter, setFilter] = useState('');
  const [text, setText] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const [pick, setPick] = useState(null);
  const endRef = useRef(null);
  const toast = useToast();

  useEffect(() => {
    document.title = `${t('Tin nhắn')} | Linko`;
  }, [t]);

  useEffect(() => {
    if (!withPerson || !social.ready) return;
    const p = byId.get(Number(withPerson));
    if (p) {
      social.openConversation(p);
      navigate(`/messages?c=conv-${p.employee_id}`, { replace: true });
    }
  }, [withPerson, social.ready, byId]); // eslint-disable-line react-hooks/exhaustive-deps

  const convs = useMemo(() => {
    const f = fold(filter);
    return social.conversations
      .filter((c) => !f || fold(c.personName).includes(f))
      .map((c) => ({ ...c, last: c.messages[c.messages.length - 1] }))
      .sort((a, b) => new Date(b.last?.time || 0) - new Date(a.last?.time || 0));
  }, [social.conversations, filter]);
  const active = social.conversations.find((c) => c.id === activeId);

  useEffect(() => {
    if (active?.unread) social.readConversation(active.id);
  }, [active?.id, active?.unread]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [active?.messages.length, social.typing[activeId]]);

  const send = (e) => {
    e.preventDefault();
    if (!text.trim() || !active) return;
    social.sendMessage(active.id, text.trim());
    setText('');
  };

  const removeConversation = (conv) => {
    const index = social.conversations.findIndex((c) => c.id === conv.id);
    social.deleteConversation(conv.id);
    navigate('/messages', { replace: true });
    toast.show({ tone: 'info', title: t('Đã xoá hội thoại với {name}', { name: conv.personName }), action: t('Hoàn tác'), onAction: () => social.restoreConversation(conv, index) });
  };

  const removeMessage = (m) => {
    social.deleteMessage(active.id, m.id);
    toast.show({ tone: 'info', title: t('Đã thu hồi tin nhắn') });
  };

  const startNew = () => {
    const p = byId.get(Number(pick));
    if (!p) return;
    social.openConversation(p);
    setNewOpen(false);
    setPick(null);
    navigate(`/messages?c=conv-${p.employee_id}`);
  };

  return (
    <div className={`page chat-page${active ? ' has-active' : ''}`}>
      <div className="chat-crumbs">
        <Breadcrumbs items={[{ label: t('Trang chủ'), to: '/' }, { label: t('Tin nhắn') }]} />
      </div>
      <div className="chat">
        <section className="chat-list" aria-label={t('Danh sách hội thoại')}>
          <div className="chat-list-head">
            <h1 className="t-h3">{t('Tin nhắn')}</h1>
            <IconButton icon="pen-to-square" label={t('Tin nhắn mới')} variant="soft" onClick={() => setNewOpen(true)} />
          </div>
          <div className="input-wrap has-icon chat-filter">
            <Icon name="magnifying-glass" size={14} className="input-icon" />
            <input className="input" placeholder={t('Lọc theo tên')} value={filter} onChange={(e) => setFilter(e.target.value)} aria-label={t('Lọc hội thoại theo tên')} />
          </div>
          {!social.ready ? (
            <SkeletonList count={5} />
          ) : convs.length === 0 ? (
            <EmptyState compact icon="comments" title={filter ? t('Không có hội thoại khớp') : t('Chưa có hội thoại')} description={t('Bắt đầu trò chuyện với một đồng nghiệp.')} action={t('Tin nhắn mới')} onAction={() => setNewOpen(true)} />
          ) : (
            <ul className="conv-list">
              {convs.map((c) => (
                <li key={c.id}>
                  <Link to={`/messages?c=${c.id}`} className={`conv${c.id === activeId ? ' is-active' : ''}${c.unread ? ' is-unread' : ''}`} aria-current={c.id === activeId ? 'true' : undefined}>
                    <Avatar id={c.personId} name={c.personName} size="md" />
                    <span className="conv-text">
                      <span className="conv-top">
                        <span className="t-label truncate">{c.personName}</span>
                        {c.last && <time className="conv-time">{relTime(c.last.time, lang)}</time>}
                      </span>
                      <span className="conv-last truncate">
                        {social.typing[c.id] ? <em className="typing-text">{t('đang nhập...')}</em> : c.last ? `${c.last.from === 'me' ? `${t('Bạn')}: ` : ''}${c.last.text}` : t('Chưa có tin nhắn')}
                      </span>
                    </span>
                    {c.unread > 0 && <span className="count-badge">{c.unread}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="chat-room" aria-label={active ? t('Hội thoại với {name}', { name: active.personName }) : t('Hội thoại')}>
          {!active ? (
            <EmptyState mascot title={t('Chọn một hội thoại')} description={t('Tin nhắn giúp bạn trao đổi nhanh với đồng đội mà không cần mở email.')} action={t('Tin nhắn mới')} onAction={() => setNewOpen(true)} />
          ) : (
            <>
              <header className="room-head">
                <IconButton icon="arrow-left" label={t('Quay lại danh sách')} className="only-mobile" onClick={() => navigate('/messages')} tooltip={false} />
                <Avatar id={active.personId} name={active.personName} size="md" />
                <div className="room-who">
                  <Link to={`/people/${active.personId}`} className="t-label">{active.personName}</Link>
                  <span className="muted t-caption">{t(PRESENCE_TEXT[presenceOf(active.personId)] || '')}{active.personTitle ? `, ${active.personTitle}` : ''}</span>
                </div>
                <Button size="sm" variant="ghost" iconStart="compass" onClick={() => navigate(`/path?to=${active.personId}`)} className="hide-mobile">
                  {t('Tìm đường kết nối')}
                </Button>
                <Menu
                  label={t('Tuỳ chọn hội thoại')}
                  trigger={(props) => (
                    <button type="button" className="ibtn ibtn-ghost ibtn-md" aria-label={t('Tuỳ chọn hội thoại')} {...props}>
                      <Icon name="ellipsis" size={18} />
                    </button>
                  )}
                  items={[
                    { id: 'profile', label: t('Xem hồ sơ'), icon: 'circle-user', onSelect: () => navigate(`/people/${active.personId}`) },
                    { id: 'path', label: t('Tìm đường kết nối'), icon: 'compass', onSelect: () => navigate(`/path?to=${active.personId}`) },
                    { divider: true },
                    { id: 'del', label: t('Xoá hội thoại'), icon: 'trash-can', tone: 'danger', onSelect: () => removeConversation(active) },
                  ]}
                />
              </header>
              <div className="room-body" role="log" aria-live="polite">
                {active.messages.length === 0 && <p className="room-empty">{t('Gửi lời chào đầu tiên tới {name}.', { name: active.personName })}</p>}
                {active.messages.map((m, i) => {
                  const prev = active.messages[i - 1];
                  const next = active.messages[i + 1];
                  const first = !prev || prev.from !== m.from;
                  const last = !next || next.from !== m.from;
                  return (
                    <div key={m.id} className={`bubble-row ${m.from === 'me' ? 'out' : 'in'}${first ? ' is-first' : ''}`}>
                      {m.from === 'me' && (
                        <IconButton icon="trash-can" label={t('Thu hồi tin nhắn')} size="sm" variant="ghost" className="bubble-del" onClick={() => removeMessage(m)} tooltip={false} />
                      )}
                      <div className={`bubble${last ? ' has-tail' : ''}`}>
                        <p>{m.text}</p>
                        {last && (
                          <span className="bubble-meta">
                            <time title={formatDateTime(m.time, lang)}>{relTime(m.time, lang)}</time>
                            {m.from === 'me' && <Icon name={m.status === 'seen' ? 'check-double' : 'check'} size={11} label={m.status === 'seen' ? t('Đã xem') : t('Đã gửi')} />}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {social.typing[active.id] && (
                  <div className="bubble-row in is-first">
                    <div className="bubble typing" aria-label={t('{name} đang nhập', { name: active.personName })}>
                      <span className="dots" aria-hidden="true">
                        <i />
                        <i />
                        <i />
                      </span>
                    </div>
                  </div>
                )}
                <div ref={endRef} />
              </div>
              <form className="room-compose" onSubmit={send}>
                <input
                  className="input"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={t('Nhắn cho {name}', { name: active.personName.split(' ').pop() })}
                  aria-label={t('Nội dung tin nhắn')}
                  maxLength={1000}
                />
                <Button type="submit" variant="primary" iconStart="paper-plane" disabled={!text.trim()}>
                  <span className="hide-mobile">{t('Gửi')}</span>
                </Button>
              </form>
            </>
          )}
        </section>
      </div>

      <Dialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        title={t('Tin nhắn mới')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setNewOpen(false)}>
              {t('Huỷ')}
            </Button>
            <Button variant="primary" disabled={!pick} onClick={startNew}>
              {t('Bắt đầu trò chuyện')}
            </Button>
          </>
        }
      >
        <PersonPicker label={t('Gửi tới')} value={pick} onChange={setPick} />
      </Dialog>
    </div>
  );
}
