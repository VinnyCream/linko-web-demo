import { useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import Avatar from '../components/Avatar.jsx';
import Icon from '../components/Icon.jsx';
import { Button, IconButton } from '../components/Button.jsx';
import { Tabs } from '../components/Form.jsx';
import { EmptyState, SkeletonList } from '../components/Feedback.jsx';
import Pagination, { usePaged } from '../components/Pagination.jsx';
import { Link, useNavigate } from '../lib/router.jsx';
import { usePrefs, useT } from '../state/prefs.jsx';
import { useSocial } from '../state/social.jsx';
import { formatDateTime, relTime } from '../lib/format.js';
import { useToast } from '../components/Toast.jsx';

const KIND_ICON = { teammate: 'user-group', mention: 'at', comment: 'comment', project: 'folder', system: 'circle-info', like: 'thumbs-up', connection: 'handshake' };

function sentence(n, t) {
  switch (n.kind) {
    case 'teammate':
      return (
        <>
          <strong>{n.actorName}</strong> {t('và bạn trở thành đồng đội trong dự án')} <strong>{n.projectName}</strong>.
        </>
      );
    case 'project':
      return (
        <>
          {t('Bạn được thêm vào dự án')} <strong>{n.projectName}</strong>
          {n.role ? ` ${t('với vai trò')} ${n.role}` : ''}.
        </>
      );
    case 'system':
      return t(n.text);
    default:
      return (
        <>
          <strong>{n.actorName}</strong> {t(n.text)}.
        </>
      );
  }
}

export function NotificationRow({ n, compact = false, onOpen, onRemove }) {
  const t = useT();
  const { lang } = usePrefs();
  const social = useSocial();
  const navigate = useNavigate();
  const target = n.link || (n.kind === 'teammate' || n.kind === 'project' ? `/projects/${n.projectId}` : n.actorId ? `/people/${n.actorId}` : '/notifications');
  const open = () => {
    social.markRead(n.id);
    onOpen?.();
    navigate(target);
  };
  return (
    <li className={`notif${n.unread ? ' is-unread' : ''}${compact ? ' is-compact' : ''}`}>
      <button type="button" className="notif-main" onClick={open}>
        <span className="notif-visual">
          {n.actorName ? <Avatar id={n.actorId} name={n.actorName} size={compact ? 'sm' : 'md'} presence={false} decorative /> : <span className="notif-sys"><Icon name="circle-info" size={16} /></span>}
          <span className={`notif-kind kind-${n.kind}`} aria-hidden="true">
            <Icon name={KIND_ICON[n.kind] || 'bell'} size={10} filled />
          </span>
        </span>
        <span className="notif-text">
          <span className="notif-sentence">{sentence(n, t)}</span>
          <time className="notif-time" dateTime={n.time} title={formatDateTime(n.time, lang)}>
            {relTime(n.time, lang)}
          </time>
        </span>
        {n.unread && <span className="unread-dot" aria-label={t('Chưa đọc')} />}
      </button>
      {onRemove && (
        <span className="notif-tools">
          {n.unread && <IconButton icon="check" label={t('Đánh dấu đã đọc')} size="sm" variant="ghost" onClick={() => social.markRead(n.id)} />}
          <IconButton icon="xmark" label={t('Gỡ thông báo')} size="sm" variant="ghost" onClick={() => onRemove(n)} />
        </span>
      )}
    </li>
  );
}

export default function Notifications() {
  const t = useT();
  const social = useSocial();
  const toast = useToast();
  const [tab, setTab] = useState('all');
  const [page, setPage] = useState(1);
  const list = useMemo(() => {
    const items = social.notifications;
    if (tab === 'unread') return items.filter((n) => n.unread);
    if (tab === 'network') return items.filter((n) => ['teammate', 'project', 'connection'].includes(n.kind));
    if (tab === 'mentions') return items.filter((n) => ['mention', 'comment', 'like'].includes(n.kind));
    return items;
  }, [social.notifications, tab]);
  const paged = usePaged(list, page, 10);
  const unread = social.unreadNotifications;

  const remove = (n) => {
    const index = social.notifications.findIndex((x) => x.id === n.id);
    social.removeNotification(n.id);
    toast.show({ tone: 'info', title: t('Đã gỡ thông báo'), action: t('Hoàn tác'), onAction: () => social.restoreNotification(n, index) });
  };
  const readCount = social.notifications.length - unread;
  const clearRead = () => {
    const before = social.notifications;
    social.clearReadNotifications();
    toast.show({ tone: 'info', title: t('Đã dọn {n} thông báo đã đọc', { n: readCount }), action: t('Hoàn tác'), onAction: () => before.filter((x) => !x.unread).forEach((x) => social.restoreNotification(x, before.indexOf(x))) });
  };

  const markAll = () => {
    social.markAllRead();
    toast.show({ tone: 'success', title: t('Đã đánh dấu tất cả là đã đọc') });
  };

  return (
    <div className="page page-narrow">
      <PageHeader
        title={t('Thông báo')}
        crumbs={[{ label: t('Thông báo') }]}
        description={unread ? t('Bạn có {n} thông báo chưa đọc.', { n: unread }) : t('Bạn đã xem hết thông báo.')}
        actions={
          (unread > 0 || readCount > 0) && (
            <>
              {readCount > 0 && (
                <Button variant="ghost" iconStart="trash-can" onClick={clearRead}>
                  {t('Dọn thông báo đã đọc')}
                </Button>
              )}
              {unread > 0 && (
                <Button iconStart="check-double" onClick={markAll}>
                  {t('Đánh dấu tất cả đã đọc')}
                </Button>
              )}
            </>
          )
        }
      />
      <Tabs
        label={t('Lọc thông báo')}
        value={tab}
        onChange={(v) => {
          setTab(v);
          setPage(1);
        }}
        tabs={[
          { value: 'all', label: t('Tất cả'), count: social.notifications.length },
          { value: 'unread', label: t('Chưa đọc'), count: unread },
          { value: 'network', label: t('Mạng lưới') },
          { value: 'mentions', label: t('Nhắc đến và tương tác') },
        ]}
      />
      <section className="panel panel-flush">
        {!social.ready ? (
          <SkeletonList count={6} />
        ) : list.length === 0 ? (
          <EmptyState
            variant="empty"
            icon="bell"
            title={tab === 'unread' ? t('Không còn thông báo chưa đọc') : t('Chưa có thông báo nào')}
            description={t('Khi đồng nghiệp nhắc đến bạn, thêm bạn vào dự án hoặc trở thành đồng đội, thông báo sẽ hiện ở đây.')}
          >
            <Link to="/connections" className="link">{t('Xem kết nối của bạn')}</Link>
          </EmptyState>
        ) : (
          <ul className="notif-list">
            {paged.slice.map((n) => (
              <NotificationRow key={n.id} n={n} onRemove={remove} />
            ))}
          </ul>
        )}
      </section>
      <Pagination page={paged.page} pageCount={paged.pageCount} total={paged.total} size={10} onPage={setPage} />
    </div>
  );
}
