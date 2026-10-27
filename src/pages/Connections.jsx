import { useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import Avatar from '../components/Avatar.jsx';
import Icon from '../components/Icon.jsx';
import { Button } from '../components/Button.jsx';
import { Tabs } from '../components/Form.jsx';
import Menu from '../components/Menu.jsx';
import { ConnectionTag, CONNECTION_TYPES } from '../components/Badge.jsx';
import { StrengthMeter } from '../components/DataBits.jsx';
import { EmptyState, ErrorState, LoadingNote, SkeletonList } from '../components/Feedback.jsx';
import Pagination, { usePaged } from '../components/Pagination.jsx';
import { Link, useLocation, useNavigate } from '../lib/router.jsx';
import { usePrefs, useT } from '../state/prefs.jsx';
import { useSession } from '../auth/session.jsx';
import { can } from '../auth/permissions.js';
import { useQuery } from '../hooks/useQuery.js';
import { api } from '../api/endpoints.js';
import { fold, formatDate } from '../lib/format.js';
import { CreateConnectionDialog, DeleteConnectionDialog, EditConnectionDialog } from './ConnectionDialogs.jsx';

export default function Connections() {
  const t = useT();
  const { lang } = usePrefs();
  const navigate = useNavigate();
  const location = useLocation();
  const { me, role } = useSession();
  const myId = me?.employee_id;
  const q = useQuery(myId ? `connections:${myId}` : null, () => api.connections({ employee_id: myId, limit: 500 }), { enabled: Boolean(myId) });
  const [type, setType] = useState(location.query.get('type') || 'ALL');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('strength');
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState(null);
  const writer = can.write(role);

  const rows = useMemo(() => {
    const f = fold(search);
    return (q.data || [])
      .map((k) => {
        const outgoing = k.from_emp === myId;
        return { ...k, outgoing, otherId: outgoing ? k.to_emp : k.from_emp, otherName: outgoing ? k.to_name : k.from_name, auto: String(k.notes || '').startsWith('Auto-created') };
      })
      .filter((k) => type === 'ALL' || k.connection_type === type)
      .filter((k) => !f || fold(k.otherName).includes(f))
      .sort((a, b) => (sort === 'strength' ? Number(b.strength) - Number(a.strength) : sort === 'recent' ? String(b.since_date).localeCompare(String(a.since_date)) : String(a.otherName).localeCompare(String(b.otherName), 'vi')));
  }, [q.data, type, search, sort, myId]);
  const counts = useMemo(() => {
    const c = { ALL: q.data?.length || 0 };
    (q.data || []).forEach((k) => {
      c[k.connection_type] = (c[k.connection_type] || 0) + 1;
    });
    return c;
  }, [q.data]);
  const paged = usePaged(rows, page, 12);
  const people = new Set((q.data || []).map((k) => (k.from_emp === myId ? k.to_emp : k.from_emp))).size;

  if (!myId) {
    return (
      <div className="page">
        <PageHeader title={t('Kết nối của tôi')} crumbs={[{ label: t('Mạng lưới') }, { label: t('Kết nối của tôi') }]} />
        <EmptyState icon="link" title={t('Chưa liên kết hồ sơ nhân viên')} description={t('Token của bạn chưa gắn với một mã nhân viên. Nhập mã nhân viên trong Cài đặt để xem kết nối của bạn.')} action={t('Mở Cài đặt')} onAction={() => navigate('/settings')} />
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        title={t('Kết nối của tôi')}
        crumbs={[{ label: t('Mạng lưới') }, { label: t('Kết nối của tôi') }]}
        description={q.data ? t('Bạn có {n} quan hệ với {p} đồng nghiệp.', { n: counts.ALL, p: people }) : null}
        actions={
          <>
            <Button iconStart="map" onClick={() => navigate(`/network?center=${myId}`)}>
              {t('Xem trên bản đồ')}
            </Button>
            {writer && (
              <Button variant="primary" iconStart="plus" onClick={() => setDialog({ kind: 'create' })}>
                {t('Tạo kết nối')}
              </Button>
            )}
          </>
        }
      />
      {!writer && (
        <p className="hint-line">
          <Icon name="circle-info" size={14} />
          {t('Đồng đội được tạo tự động khi bạn cùng dự án. Các loại kết nối khác do bộ phận Nhân sự ghi nhận.')}
        </p>
      )}
      <Tabs
        label={t('Lọc theo loại kết nối')}
        value={type}
        onChange={(v) => {
          setType(v);
          setPage(1);
        }}
        tabs={[{ value: 'ALL', label: t('Tất cả'), count: counts.ALL }, ...Object.entries(CONNECTION_TYPES).filter(([k]) => counts[k]).map(([k, c]) => ({ value: k, label: t(c.label), icon: c.icon, count: counts[k] }))]}
      />
      <div className="toolbar">
        <div className="input-wrap has-icon toolbar-search">
          <Icon name="magnifying-glass" size={14} className="input-icon" />
          <input className="input" type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={t('Tìm trong kết nối của bạn')} aria-label={t('Tìm trong kết nối của bạn')} />
        </div>
        <label className="inline-select">
          <span className="muted t-ui">{t('Sắp xếp')}</span>
          <select className="input select select-sm" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="strength">{t('Độ mạnh')}</option>
            <option value="recent">{t('Mới nhất')}</option>
            <option value="name">{t('Tên A đến Z')}</option>
          </select>
        </label>
      </div>
      <section className="panel panel-flush">
        {q.loading ? (
          <>
            <LoadingNote slow={q.slow} />
            <SkeletonList count={8} />
          </>
        ) : q.error ? (
          <ErrorState error={q.error} onRetry={q.refetch} />
        ) : rows.length === 0 ? (
          counts.ALL === 0 ? (
            <EmptyState mascot title={t('Bạn chưa có kết nối nào')} description={t('Kết nối với đồng đội để thấy cập nhật của họ trên bảng tin.')} action={t('Tìm đồng nghiệp')} onAction={() => navigate('/directory')} />
          ) : (
            <EmptyState variant="search" compact title={t('Không có kết nối khớp')} description={t('Thử bỏ bộ lọc loại hoặc tìm tên khác.')} action={t('Xoá bộ lọc')} onAction={() => { setType('ALL'); setSearch(''); }} />
          )
        ) : (
          <ul className="row-list padded">
            {paged.slice.map((k) => (
              <li key={`${k.from_emp}-${k.to_emp}`} className="row-item conn-row">
                <Avatar id={k.otherId} name={k.otherName} size="md" />
                <span className="row-text">
                  <Link to={`/people/${k.otherId}`} className="t-label truncate">{k.otherName}</Link>
                  <span className="muted t-caption truncate">
                    <Icon name={k.outgoing ? 'arrow-right' : 'arrow-left'} size={10} /> {k.outgoing ? t('Bạn kết nối tới') : t('Kết nối tới bạn')}, {t('từ {date}', { date: formatDate(k.since_date, lang) })}
                    {k.notes && !k.auto ? `. ${k.notes}` : ''}
                  </span>
                </span>
                <span className="conn-meta">
                  <ConnectionTag type={k.connection_type} auto={k.auto} />
                  <StrengthMeter value={k.strength} />
                </span>
                <Menu
                  label={t('Thao tác')}
                  trigger={(props) => (
                    <button type="button" className="ibtn ibtn-ghost ibtn-sm" aria-label={t('Thao tác với {name}', { name: k.otherName })} {...props}>
                      <Icon name="ellipsis" size={16} />
                    </button>
                  )}
                  items={[
                    { id: 'msg', label: t('Nhắn tin'), icon: 'comments', onSelect: () => navigate(`/messages?to=${k.otherId}`) },
                    { id: 'path', label: t('Xem mạng 2 bậc của {name}', { name: k.otherName.split(' ').pop() }), icon: 'map', onSelect: () => navigate(`/network?center=${k.otherId}`) },
                    writer && { divider: true },
                    writer && { id: 'edit', label: t('Sửa kết nối'), icon: 'pen', onSelect: () => setDialog({ kind: 'edit', conn: k }) },
                    can.remove(role) && { id: 'del', label: t('Xoá kết nối'), icon: 'trash-can', tone: 'danger', onSelect: () => setDialog({ kind: 'delete', conn: k }) },
                  ]}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
      <Pagination page={paged.page} pageCount={paged.pageCount} total={paged.total} size={12} onPage={setPage} />
      <CreateConnectionDialog open={dialog?.kind === 'create'} onClose={() => setDialog(null)} fromId={myId} />
      <EditConnectionDialog open={dialog?.kind === 'edit'} connection={dialog?.conn} onClose={() => setDialog(null)} />
      <DeleteConnectionDialog open={dialog?.kind === 'delete'} connection={dialog?.conn} onClose={() => setDialog(null)} />
    </div>
  );
}
