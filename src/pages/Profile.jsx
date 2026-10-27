import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import Avatar from '../components/Avatar.jsx';
import Icon from '../components/Icon.jsx';
import { Button } from '../components/Button.jsx';
import { Tabs } from '../components/Form.jsx';
import Menu from '../components/Menu.jsx';
import { ConnectionTag, StatusBadge } from '../components/Badge.jsx';
import { MaskedField, Metric, StrengthMeter } from '../components/DataBits.jsx';
import { EmptyState, ErrorState, LoadingNote, Skeleton, SkeletonList } from '../components/Feedback.jsx';
import AvatarEditor from '../components/AvatarEditor.jsx';
import Pagination, { usePaged } from '../components/Pagination.jsx';
import { Link, useLocation, useNavigate, useParams } from '../lib/router.jsx';
import { usePrefs, useT } from '../state/prefs.jsx';
import { useSession } from '../auth/session.jsx';
import { usePeople } from '../state/people.jsx';
import { can } from '../auth/permissions.js';
import { useQuery } from '../hooks/useQuery.js';
import { api } from '../api/endpoints.js';
import { formatDate } from '../lib/format.js';
import { DeleteEmployeeDialog, EmployeeFormDialog, ManagerDialog } from './EmployeeDialogs.jsx';
import { CreateConnectionDialog, DeleteConnectionDialog, EditConnectionDialog } from './ConnectionDialogs.jsx';
import NotFound from './errors/NotFound.jsx';

const PRESENCE_TEXT = { online: 'Đang trực tuyến', away: 'Tạm vắng', offline: 'Ngoại tuyến' };

function PersonRow({ p, right }) {
  return (
    <li className="row-item">
      <Avatar id={p.employee_id} name={p.full_name} size="sm" />
      <span className="row-text">
        <Link to={`/people/${p.employee_id}`} className="t-label truncate">{p.full_name}</Link>
        <span className="muted t-caption truncate">{p.title}</span>
      </span>
      {right}
    </li>
  );
}

export default function Profile() {
  const t = useT();
  const { lang } = usePrefs();
  const { id } = useParams();
  const navigate = useNavigate();
  const session = useSession();
  const { presenceOf } = usePeople();
  const empId = Number(id);
  const isMe = session.me?.employee_id === empId;
  const q = useQuery(`profile:${empId}`, () => api.profile(empId));
  const managers = useQuery(`profile:${empId}:managers`, () => api.employeeManagers(empId));
  const common = useQuery(!isMe && session.me ? `profile:${empId}:common:${session.me.employee_id}` : null, () => api.commonConnections(session.me.employee_id, empId), { enabled: !isMe && Boolean(session.me) });
  const [tab, setTab] = useState('overview');
  const [dialog, setDialog] = useState(null);
  const [connPage, setConnPage] = useState(1);
  const writer = can.write(session.role);

  useEffect(() => {
    setTab('overview');
    setConnPage(1);
  }, [empId]);
  const location = useLocation();
  useEffect(() => {
    if (isMe && location.query.get('photo') === '1') {
      setDialog('avatar');
      navigate(`/people/${empId}`, { replace: true });
    }
  }, [isMe, location.search]); // eslint-disable-line react-hooks/exhaustive-deps

  const social = useMemo(() => q.data?.social_connections || [], [q.data]);
  const connPaged = usePaged(social, connPage, 10);
  const teammates = useMemo(() => {
    const map = new Map();
    (q.data?.teammates || []).forEach((tm) => {
      const key = tm.employee_id;
      if (!map.has(key)) map.set(key, { ...tm, projects: [] });
      map.get(key).projects.push(tm.project_name);
    });
    return [...map.values()];
  }, [q.data]);

  if (q.error?.status === 404) return <NotFound what={t('nhân viên này')} />;
  const e = q.data?.employee;
  const name = e?.full_name || '';
  const presence = e?.status === 'ACTIVE' ? presenceOf(empId) : null;

  return (
    <div className="page">
      <PageHeader title={name || t('Hồ sơ')} titleHidden crumbs={[{ label: t('Danh bạ'), to: '/directory' }, { label: name || t('Hồ sơ') }]} />
      {q.loading ? (
        <section className="profile-hero">
          <Skeleton variant="circle" width="96px" height="96px" />
          <div className="sk-col grow">
            <Skeleton width="40%" />
            <Skeleton width="25%" />
            <Skeleton width="55%" />
          </div>
          <LoadingNote slow={q.slow} compact />
        </section>
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={q.refetch} />
      ) : (
        <>
          <section className="profile-hero" aria-label={t('Thông tin chính')}>
            <div className="profile-photo">
              {isMe ? (
                <button type="button" className="photo-btn" onClick={() => setDialog('avatar')} aria-label={t('Đổi hoặc xoá ảnh đại diện')}>
                  <Avatar id={empId} name={name} size="xl" presence={presence || false} decorative />
                  <span className="photo-overlay" aria-hidden="true">
                    <Icon name="image" size={18} />
                    <span>{t('Đổi ảnh')}</span>
                  </span>
                </button>
              ) : (
                <Avatar id={empId} name={name} size="xl" presence={presence || false} />
              )}
            </div>
            <div className="profile-main">
              <div className="profile-name-row">
                <p className="t-h2 profile-name" aria-hidden="true">{name}</p>
                {isMe && <span className="you-tag">{t('Bạn')}</span>}
                <StatusBadge status={e.status} />
              </div>
              <p className="profile-title">{e.title || t('Chưa có chức danh')}</p>
              <p className="profile-facts">
                {e.department_id && (
                  <Link to={`/departments/${e.department_id}`} className="fact">
                    <Icon name="building" size={14} />
                    {e.department_name}
                  </Link>
                )}
                {e.location && (
                  <span className="fact">
                    <Icon name="map" size={14} />
                    {e.location}
                  </span>
                )}
                {e.hire_date && (
                  <span className="fact">
                    <Icon name="calendar" size={14} />
                    {t('Vào làm {date}', { date: formatDate(e.hire_date, lang) })}
                  </span>
                )}
                {presence && (
                  <span className="fact">
                    <span className={`presence presence-${presence} static`} aria-hidden="true" />
                    {t(PRESENCE_TEXT[presence])}
                  </span>
                )}
              </p>
              <dl className="profile-contact">
                <div>
                  <dt>{t('Email')}</dt>
                  <dd>{isMe ? <a href={`mailto:${e.email}`}>{e.email}</a> : <MaskedField type="email" value={e.email} canReveal={can.revealPersonal(session.role)} />}</dd>
                </div>
                <div>
                  <dt>{t('Điện thoại')}</dt>
                  <dd>{isMe ? e.phone || <span className="muted">{t('Chưa cập nhật')}</span> : <MaskedField type="phone" value={e.phone} canReveal={can.revealPersonal(session.role)} />}</dd>
                </div>
              </dl>
            </div>
            <div className="profile-actions">
              {!isMe && (
                <>
                  <Button variant="primary" iconStart="comments" onClick={() => navigate(`/messages?to=${empId}`)}>
                    {t('Nhắn tin')}
                  </Button>
                  {session.me && (
                    <Button iconStart="compass" onClick={() => navigate(`/path?from=${session.me.employee_id}&to=${empId}`)}>
                      {t('Tìm đường kết nối')}
                    </Button>
                  )}
                </>
              )}
              {isMe && (
                <Button iconStart="gear" onClick={() => navigate('/settings')}>
                  {t('Cài đặt hồ sơ')}
                </Button>
              )}
              {writer && (
                <Menu
                  label={t('Thao tác quản lý')}
                  trigger={(props) => (
                    <button type="button" className="ibtn ibtn-soft" aria-label={t('Thao tác quản lý')} {...props}>
                      <Icon name="ellipsis" size={16} />
                    </button>
                  )}
                  items={[
                    { id: 'edit', label: t('Sửa thông tin'), icon: 'pen', onSelect: () => setDialog('edit') },
                    { id: 'mgr', label: t('Đổi quản lý trực tiếp'), icon: 'sitemap', onSelect: () => setDialog('manager') },
                    { id: 'conn', label: t('Tạo kết nối'), icon: 'handshake', onSelect: () => setDialog('connect') },
                    can.remove(session.role) && !isMe && { divider: true },
                    can.remove(session.role) && !isMe && { id: 'del', label: t('Xoá nhân viên'), icon: 'trash-can', tone: 'danger', onSelect: () => setDialog('delete') },
                  ]}
                />
              )}
            </div>
          </section>

          <section className="metrics" aria-label={t('Chỉ số mạng lưới')}>
            <Metric label={t('Kết nối đi')} value={q.data.network_stats.outgoing} helper={t('Người {name} kết nối tới', { name: name.split(' ').pop() })} />
            <Metric label={t('Kết nối đến')} value={q.data.network_stats.incoming} helper={t('Người kết nối tới {name}', { name: name.split(' ').pop() })} />
            <Metric label={t('Dự án')} value={q.data.network_stats.projects} helper={t('Đang tham gia')} />
            <Metric label={t('Đồng đội')} value={teammates.length} helper={t('Từ dự án chung')} tone="accent" />
          </section>

          {!isMe && common.data?.length > 0 && (
            <p className="common-line">
              <Icon name="link" size={14} />
              {t('Bạn và {name} có {n} kết nối chung', { name: name.split(' ').pop(), n: common.data.length })}:{' '}
              {common.data.slice(0, 3).map((c, i) => (
                <span key={c.employee_id}>
                  {i > 0 && ', '}
                  <Link to={`/people/${c.employee_id}`}>{c.full_name}</Link>
                </span>
              ))}
              {common.data.length > 3 && ` ${t('và {n} người khác', { n: common.data.length - 3 })}`}
            </p>
          )}

          <Tabs
            label={t('Nội dung hồ sơ')}
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'overview', label: t('Tổ chức'), icon: 'sitemap' },
              { value: 'projects', label: t('Dự án'), icon: 'folder', count: q.data.projects.length },
              { value: 'teammates', label: t('Đồng đội'), icon: 'user-group', count: teammates.length },
              { value: 'connections', label: t('Kết nối'), icon: 'handshake', count: social.length },
            ]}
          />

          {tab === 'overview' && (
            <div className="split">
              <section className="panel" aria-labelledby="mgr-chain">
                <div className="panel-head">
                  <h3 id="mgr-chain" className="t-h4">{t('Chuỗi quản lý')}</h3>
                  {writer && (
                    <Button size="sm" variant="ghost" onClick={() => setDialog('manager')}>
                      {t('Đổi')}
                    </Button>
                  )}
                </div>
                {managers.loading ? (
                  <SkeletonList count={3} />
                ) : !managers.data?.length ? (
                  <p className="muted t-ui">{t('{name} không báo cáo cho ai. Đây có thể là cấp cao nhất.', { name })}</p>
                ) : (
                  <ol className="chain">
                    {[...managers.data].reverse().map((m) => (
                      <li key={m.employee_id}>
                        <Avatar id={m.employee_id} name={m.full_name} size="sm" presence={false} />
                        <span className="row-text">
                          <Link to={`/people/${m.employee_id}`} className="t-label truncate">{m.full_name}</Link>
                          <span className="muted t-caption truncate">{m.title}</span>
                        </span>
                      </li>
                    ))}
                    <li className="is-self">
                      <Avatar id={empId} name={name} size="sm" presence={false} />
                      <span className="row-text">
                        <span className="t-label truncate">{name}</span>
                        <span className="muted t-caption truncate">{e.title}</span>
                      </span>
                    </li>
                  </ol>
                )}
              </section>
              <section className="panel" aria-labelledby="reports">
                <div className="panel-head">
                  <h3 id="reports" className="t-h4">{t('Cấp dưới trực tiếp')}</h3>
                  {q.data.direct_reports.length > 0 && (
                    <Link to={`/org?root=${empId}`} className="link t-ui">
                      {t('Xem sơ đồ')}
                    </Link>
                  )}
                </div>
                {q.data.direct_reports.length === 0 ? (
                  <p className="muted t-ui">{t('Chưa có ai báo cáo trực tiếp cho {name}.', { name })}</p>
                ) : (
                  <ul className="row-list">
                    {q.data.direct_reports.map((p) => (
                      <PersonRow key={p.employee_id} p={p} right={p.status !== 'ACTIVE' ? <StatusBadge status={p.status} /> : null} />
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}

          {tab === 'projects' && (
            <section className="panel panel-flush">
              {q.data.projects.length === 0 ? (
                <EmptyState compact icon="folder" title={t('Chưa tham gia dự án nào')} description={t('Khi được thêm vào dự án, Linko tự tạo kết nối Đồng đội với các thành viên khác.')} />
              ) : (
                <ul className="row-list padded">
                  {q.data.projects.map((p) => (
                    <li key={p.project_id} className="row-item">
                      <span className="row-icon" aria-hidden="true">
                        <Icon name="folder" size={16} />
                      </span>
                      <span className="row-text">
                        <Link to={`/projects/${p.project_id}`} className="t-label truncate">{p.project_name}</Link>
                        <span className="muted t-caption">{t('Vai trò {role}, từ {date}', { role: p.role || 'MEMBER', date: formatDate(p.join_date, lang) })}</span>
                      </span>
                      <StatusBadge kind="project" status={p.status} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {tab === 'teammates' && (
            <section className="panel panel-flush">
              {teammates.length === 0 ? (
                <EmptyState compact icon="user-group" title={t('Chưa có đồng đội')} description={t('Đồng đội là người cùng ít nhất một dự án.')} />
              ) : (
                <ul className="people-grid">
                  {teammates.map((p) => (
                    <li key={p.employee_id} className="person-tile">
                      <Avatar id={p.employee_id} name={p.full_name} size="lg" />
                      <Link to={`/people/${p.employee_id}`} className="person-name">{p.full_name}</Link>
                      <span className="muted t-caption person-sub">{p.title}</span>
                      <span className="person-projects t-caption" title={p.projects.join(', ')}>
                        <Icon name="folder" size={11} />
                        {p.projects.length === 1 ? p.projects[0] : t('{n} dự án chung', { n: p.projects.length })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {tab === 'connections' && (
            <>
              <section className="panel panel-flush">
                {writer && (
                  <div className="panel-head padded">
                    <p className="muted t-ui">{t('Kết nối có hướng: đi là {name} chủ động, đến là người khác kết nối tới.', { name: name.split(' ').pop() })}</p>
                    <Button size="sm" iconStart="plus" onClick={() => setDialog('connect')}>
                      {t('Tạo kết nối')}
                    </Button>
                  </div>
                )}
                {social.length === 0 ? (
                  <EmptyState compact icon="handshake" title={t('Chưa có kết nối')} description={t('Kết nối giúp rút ngắn đường đi giữa các đồng nghiệp.')} />
                ) : (
                  <ul className="row-list padded">
                    {connPaged.slice.map((c) => (
                      <li key={`${c.from_emp}-${c.to_emp}`} className="row-item conn-row">
                        <Avatar id={c.employee_id} name={c.full_name} size="sm" />
                        <span className="row-text">
                          <Link to={`/people/${c.employee_id}`} className="t-label truncate">{c.full_name}</Link>
                          <span className="muted t-caption truncate">
                            <Icon name={c.direction === 'outgoing' ? 'arrow-right' : 'arrow-left'} size={10} /> {c.direction === 'outgoing' ? t('Kết nối đi') : t('Kết nối đến')}, {t('từ {date}', { date: formatDate(c.since_date, lang) })}
                          </span>
                        </span>
                        <span className="conn-meta">
                          <ConnectionTag type={c.connection_type} />
                          <StrengthMeter value={c.strength} />
                        </span>
                        {writer && (
                          <Menu
                            label={t('Thao tác kết nối')}
                            trigger={(props) => (
                              <button type="button" className="ibtn ibtn-ghost ibtn-sm" aria-label={t('Thao tác kết nối với {name}', { name: c.full_name })} {...props}>
                                <Icon name="ellipsis" size={16} />
                              </button>
                            )}
                            items={[
                              { id: 'edit', label: t('Sửa kết nối'), icon: 'pen', onSelect: () => setDialog({ kind: 'edit-conn', conn: { ...c, from_name: c.direction === 'outgoing' ? name : c.full_name, to_name: c.direction === 'outgoing' ? c.full_name : name } }) },
                              can.remove(session.role) && { id: 'del', label: t('Xoá kết nối'), icon: 'trash-can', tone: 'danger', onSelect: () => setDialog({ kind: 'del-conn', conn: { ...c, from_name: c.direction === 'outgoing' ? name : c.full_name, to_name: c.direction === 'outgoing' ? c.full_name : name } }) },
                            ]}
                          />
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <Pagination page={connPaged.page} pageCount={connPaged.pageCount} total={connPaged.total} size={10} onPage={setConnPage} />
            </>
          )}

          {isMe && <AvatarEditor open={dialog === 'avatar'} onClose={() => setDialog(null)} employeeId={empId} name={name} />}
          <EmployeeFormDialog open={dialog === 'edit'} employeeId={empId} onClose={() => setDialog(null)} />
          <ManagerDialog open={dialog === 'manager'} employee={{ ...e, manager_id: e.manager_id }} onClose={() => setDialog(null)} />
          <DeleteEmployeeDialog open={dialog === 'delete'} employee={e} onClose={() => setDialog(null)} onDeleted={(mode) => mode === 'hard' && navigate('/directory')} />
          <CreateConnectionDialog open={dialog === 'connect'} onClose={() => setDialog(null)} fromId={session.me && !isMe ? session.me.employee_id : empId} toId={session.me && !isMe ? empId : null} />
          <EditConnectionDialog open={dialog?.kind === 'edit-conn'} connection={dialog?.conn} onClose={() => setDialog(null)} />
          <DeleteConnectionDialog open={dialog?.kind === 'del-conn'} connection={dialog?.conn} onClose={() => setDialog(null)} />
        </>
      )}
    </div>
  );
}
