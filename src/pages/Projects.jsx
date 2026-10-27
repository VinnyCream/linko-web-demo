import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import Avatar from '../components/Avatar.jsx';
import Icon from '../components/Icon.jsx';
import { Button } from '../components/Button.jsx';
import { PersonPicker, SegmentedControl, Select, TextField } from '../components/Form.jsx';
import { PROJECT_STATUS_LABEL, StatusBadge } from '../components/Badge.jsx';
import { Banner, EmptyState, ErrorState, LoadingNote, Skeleton, SkeletonList } from '../components/Feedback.jsx';
import { ConfirmDialog, Dialog } from '../components/Dialog.jsx';
import Menu from '../components/Menu.jsx';
import Pagination, { usePaged } from '../components/Pagination.jsx';
import { Link, useNavigate, useParams } from '../lib/router.jsx';
import { usePrefs, useT } from '../state/prefs.jsx';
import { useSession } from '../auth/session.jsx';
import { usePeople } from '../state/people.jsx';
import { can } from '../auth/permissions.js';
import { invalidate, useQuery } from '../hooks/useQuery.js';
import { api } from '../api/endpoints.js';
import { fold, formatDate } from '../lib/format.js';
import { describeError } from '../lib/errors.js';
import { useErrorToast, useToast } from '../components/Toast.jsx';
import NotFound from './errors/NotFound.jsx';

const ROLES = ['SPONSOR', 'LEAD', 'TECH_LEAD', 'PRODUCT', 'TECH', 'MEMBER', 'CONTRIBUTOR', 'ADVISOR'];
const ROLE_LABEL = { SPONSOR: 'Bảo trợ', LEAD: 'Trưởng dự án', TECH_LEAD: 'Tech Lead', PRODUCT: 'Sản phẩm', TECH: 'Kỹ thuật', MEMBER: 'Thành viên', CONTRIBUTOR: 'Cộng tác', ADVISOR: 'Cố vấn' };

function refreshProjects() {
  invalidate('projects', 'project:', 'dept:', 'profile:', 'connections', 'teammates', 'graph', 'stats', 'audit', 'departments');
}

function ProjectForm({ open, onClose, project, onSaved }) {
  const t = useT();
  const { departments } = usePeople();
  const toast = useToast();
  const empty = { project_name: '', description: '', start_date: '', end_date: '', status: 'PLANNING', department_id: '' };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState(null);
  const [state, setState] = useState(null);
  useEffect(() => {
    if (!open) return;
    setErrors({});
    setBanner(null);
    setForm(project ? { ...empty, ...Object.fromEntries(Object.entries(project).filter(([k]) => k in empty).map(([k, v]) => [k, v == null ? '' : String(v).slice(0, k.endsWith('date') ? 10 : undefined)])) } : empty);
  }, [open, project]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = async (e) => {
    e?.preventDefault();
    const next = {};
    if (!form.project_name.trim()) next.project_name = t('Nhập tên dự án.');
    if (form.start_date && form.end_date && form.end_date < form.start_date) next.end_date = t('Ngày kết thúc phải từ ngày bắt đầu trở đi.');
    setErrors(next);
    if (Object.keys(next).length) return;
    setState('loading');
    const body = { project_name: form.project_name.trim(), description: form.description.trim() || null, start_date: form.start_date || null, end_date: form.end_date || null, status: form.status, department_id: form.department_id ? Number(form.department_id) : null };
    try {
      let saved;
      if (project) saved = await api.updateProject(project.project_id, body);
      else {
        Object.keys(body).forEach((k) => body[k] === null && delete body[k]);
        saved = await api.createProject(body);
      }
      refreshProjects();
      toast.show({ tone: 'success', title: project ? t('Đã lưu thay đổi') : t('Đã tạo dự án {name}', { name: body.project_name }) });
      onClose();
      onSaved?.(saved);
    } catch (err) {
      if (err.code === 'INVALID_DATES') setErrors({ end_date: describeError(err, t).message });
      else setBanner(describeError(err, t));
    } finally {
      setState(null);
    }
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={project ? t('Sửa dự án') : t('Tạo dự án')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('Huỷ')}
          </Button>
          <Button variant="primary" onClick={submit} state={state}>
            {project ? t('Lưu thay đổi') : t('Tạo dự án')}
          </Button>
        </>
      }
    >
      <form className="form-grid" onSubmit={submit} noValidate>
        {banner && (
          <Banner tone="danger" title={banner.title} className="span-2">
            {banner.message}
          </Banner>
        )}
        <TextField className="span-2" label={t('Tên dự án')} required value={form.project_name} onChange={set('project_name')} error={errors.project_name} maxLength={150} />
        <TextField className="span-2" multiline rows={3} label={t('Mô tả')} value={form.description} onChange={set('description')} maxLength={500} counter />
        <TextField label={t('Ngày bắt đầu')} type="date" value={form.start_date} onChange={set('start_date')} />
        <TextField label={t('Ngày kết thúc')} type="date" value={form.end_date} onChange={set('end_date')} error={errors.end_date} />
        <Select label={t('Trạng thái')} value={form.status} onChange={set('status')} options={Object.entries(PROJECT_STATUS_LABEL).map(([value, label]) => ({ value, label: t(label) }))} />
        <Select label={t('Phòng ban phụ trách')} value={form.department_id} onChange={set('department_id')} options={[{ value: '', label: t('Chưa chọn') }, ...departments.map((d) => ({ value: d.department_id, label: d.department_name }))]} />
      </form>
    </Dialog>
  );
}

function DeleteProject({ open, onClose, project, onDone }) {
  const t = useT();
  const toast = useToast();
  const showError = useErrorToast();
  const [impact, setImpact] = useState(null);
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState(null);
  useEffect(() => {
    if (!open || !project) return;
    setLoading(true);
    api.projectImpact(project.project_id).then(setImpact).catch(showError).finally(() => setLoading(false));
  }, [open, project]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!project) return null;
  const confirm = async () => {
    setState('loading');
    try {
      await api.deleteProject(project.project_id, impact?.has_dependencies);
      refreshProjects();
      toast.show({ tone: 'success', title: t('Đã xoá dự án {name}', { name: project.project_name }) });
      onClose();
      onDone?.();
    } catch (err) {
      showError(err);
    } finally {
      setState(null);
    }
  };
  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={confirm}
      state={state}
      impactLoading={loading}
      title={t('Xoá vĩnh viễn dự án {name}?', { name: project.project_name })}
      description={t('Thành viên sẽ bị gỡ khỏi dự án; trigger xoá các kết nối Đồng đội tự sinh không còn dự án chung. Cân nhắc chuyển trạng thái sang Đã huỷ thay vì xoá.')}
      impact={impact ? [{ label: t('Thành viên dự án'), count: impact.dependencies?.memberships ?? 0, icon: 'users' }] : null}
      confirmText={project.project_name}
      confirmLabel={t('Xoá dự án')}
    />
  );
}

export function ProjectList() {
  const t = useT();
  const { lang } = usePrefs();
  const navigate = useNavigate();
  const { role } = useSession();
  const q = useQuery('projects', () => api.projects());
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState(null);
  const rows = useMemo(() => (q.data || []).filter((p) => !status || p.status === status).filter((p) => !search || fold(`${p.project_name} ${p.description} ${p.department_name}`).includes(fold(search))), [q.data, status, search]);
  const paged = usePaged(rows, page, 9);
  const counts = useMemo(() => {
    const c = {};
    (q.data || []).forEach((p) => {
      c[p.status] = (c[p.status] || 0) + 1;
    });
    return c;
  }, [q.data]);
  return (
    <div className="page">
      <PageHeader
        title={t('Dự án')}
        crumbs={[{ label: t('Tổ chức') }, { label: t('Dự án') }]}
        description={q.data ? t('{a} dự án đang chạy trên tổng số {n}.', { a: counts.ACTIVE || 0, n: q.data.length }) : null}
        actions={can.write(role) && (
          <Button variant="primary" iconStart="plus" onClick={() => setDialog({ kind: 'create' })}>
            {t('Tạo dự án')}
          </Button>
        )}
      />
      <div className="toolbar">
        <div className="input-wrap has-icon toolbar-search">
          <Icon name="magnifying-glass" size={14} className="input-icon" />
          <input className="input" type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={t('Tìm dự án')} aria-label={t('Tìm dự án')} />
        </div>
        <Select className="toolbar-select" aria-label={t('Trạng thái')} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} options={[{ value: '', label: t('Mọi trạng thái') }, ...Object.entries(PROJECT_STATUS_LABEL).map(([value, label]) => ({ value, label: `${t(label)} (${counts[value] || 0})` }))]} />
      </div>
      {q.loading ? (
        <div className="project-grid">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="project-tile">
              <Skeleton width="70%" />
              <Skeleton lines={2} />
            </div>
          ))}
          <LoadingNote slow={q.slow} />
        </div>
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={q.refetch} />
      ) : rows.length === 0 ? (
        <EmptyState variant="search" title={t('Không có dự án khớp')} description={t('Thử bỏ bộ lọc trạng thái hoặc tìm tên khác.')} action={t('Xoá bộ lọc')} onAction={() => { setStatus(''); setSearch(''); }} />
      ) : (
        <ul className="project-grid">
          {paged.slice.map((p) => (
            <li key={p.project_id} className="project-tile">
              <div className="project-top">
                <StatusBadge kind="project" status={p.status} />
                <span className="muted t-caption lk-num">
                  <Icon name="users" size={12} /> {p.member_count}
                </span>
              </div>
              <Link to={`/projects/${p.project_id}`} className="project-name">{p.project_name}</Link>
              <p className="project-desc">{p.description || t('Chưa có mô tả.')}</p>
              <p className="project-meta t-caption muted">
                <span className="truncate">{p.department_name || t('Chưa có phòng phụ trách')}</span>
                {p.start_date && <span>{t('Từ {date}', { date: formatDate(p.start_date, lang) })}</span>}
              </p>
            </li>
          ))}
        </ul>
      )}
      <Pagination page={paged.page} pageCount={paged.pageCount} total={paged.total} size={9} onPage={setPage} />
      <ProjectForm open={dialog?.kind === 'create'} onClose={() => setDialog(null)} onSaved={(p) => p?.project_id && navigate(`/projects/${p.project_id}`)} />
    </div>
  );
}

export function ProjectDetail() {
  const t = useT();
  const { lang } = usePrefs();
  const { id } = useParams();
  const navigate = useNavigate();
  const { role } = useSession();
  const toast = useToast();
  const showError = useErrorToast();
  const proj = useQuery(`project:${id}`, () => api.project(id));
  const members = useQuery(`project:${id}:members`, () => api.projectMembers(id));
  const { departments } = usePeople();
  const [dialog, setDialog] = useState(null);
  const [add, setAdd] = useState({ employee: null, role: 'MEMBER' });
  const [addState, setAddState] = useState(null);
  const [addError, setAddError] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [view, setView] = useState('role');
  const p = proj.data;
  const writer = can.write(role);
  const closed = p && ['COMPLETED', 'CANCELLED'].includes(p.status);
  const deptName = departments.find((d) => d.department_id === p?.department_id)?.department_name;
  const grouped = useMemo(() => {
    const list = members.data || [];
    if (view !== 'role') return [{ key: 'all', items: [...list].sort((a, b) => String(a.full_name).localeCompare(String(b.full_name), 'vi')) }];
    const order = (r) => (ROLES.indexOf(r) === -1 ? 99 : ROLES.indexOf(r));
    const map = new Map();
    [...list].sort((a, b) => order(a.role) - order(b.role)).forEach((m) => {
      if (!map.has(m.role)) map.set(m.role, []);
      map.get(m.role).push(m);
    });
    return [...map.entries()].map(([key, items]) => ({ key, items }));
  }, [members.data, view]);
  if (proj.error?.status === 404) return <NotFound what={t('dự án này')} />;

  const addMember = async () => {
    setAddState('loading');
    setAddError(null);
    try {
      const res = await api.addProjectMember(Number(id), add.employee, add.role);
      setLastResult(res);
      refreshProjects();
      toast.show({ tone: 'success', title: t('Đã thêm thành viên'), message: res.new_teammate_edge_count ? t('Trigger đã tạo {n} kết nối Đồng đội mới.', { n: res.new_teammate_edge_count }) : t('Không có kết nối Đồng đội mới vì các cặp đã kết nối từ trước.') });
      setDialog(null);
      setAdd({ employee: null, role: 'MEMBER' });
    } catch (err) {
      setAddError(describeError(err, t));
    } finally {
      setAddState(null);
    }
  };
  const changeRole = async (m, newRole) => {
    try {
      await api.upsertProjectMember(Number(id), m.employee_id, { role: newRole });
      refreshProjects();
      toast.show({ tone: 'success', title: t('Đã đổi vai trò của {name}', { name: m.full_name }) });
    } catch (err) {
      showError(err);
    }
  };
  const removeMember = async (m) => {
    try {
      await api.removeProjectMember(Number(id), m.employee_id);
      refreshProjects();
      toast.show({ tone: 'success', title: t('Đã gỡ {name} khỏi dự án', { name: m.full_name }), message: t('Kết nối Đồng đội tự sinh không còn dự án chung đã được dọn.') });
    } catch (err) {
      showError(err);
    }
    setDialog(null);
  };

  return (
    <div className="page">
      <PageHeader
        title={p?.project_name || t('Dự án')}
        crumbs={[{ label: t('Dự án'), to: '/projects' }, { label: p?.project_name || '...' }]}
        description={p?.description}
        meta={
          p && (
            <>
              <StatusBadge kind="project" status={p.status} />
              {deptName && (
                <Link to={`/departments/${p.department_id}`} className="fact">
                  <Icon name="building" size={14} />
                  {deptName}
                </Link>
              )}
              {(p.start_date || p.end_date) && (
                <span className="fact">
                  <Icon name="calendar" size={14} />
                  {p.start_date ? formatDate(p.start_date, lang) : '?'} {t('đến')} {p.end_date ? formatDate(p.end_date, lang) : t('nay')}
                </span>
              )}
            </>
          )
        }
        actions={
          p &&
          writer && (
            <>
              <Button variant="primary" iconStart="user-plus" onClick={() => setDialog({ kind: 'add' })} disabled={closed} title={closed ? t('Dự án đã đóng') : undefined}>
                {t('Thêm thành viên')}
              </Button>
              <Menu
                label={t('Thao tác dự án')}
                trigger={(props) => (
                  <button type="button" className="ibtn ibtn-soft" aria-label={t('Thao tác dự án')} {...props}>
                    <Icon name="ellipsis" size={16} />
                  </button>
                )}
                items={[
                  { id: 'edit', label: t('Sửa dự án'), icon: 'pen', onSelect: () => setDialog({ kind: 'edit' }) },
                  can.remove(role) && { divider: true },
                  can.remove(role) && { id: 'del', label: t('Xoá dự án'), icon: 'trash-can', tone: 'danger', onSelect: () => setDialog({ kind: 'delete' }) },
                ]}
              />
            </>
          )
        }
      />
      {proj.loading && <Skeleton lines={2} />}
      {proj.error && <ErrorState error={proj.error} onRetry={proj.refetch} />}
      {lastResult?.new_teammate_edges?.length > 0 && (
        <Banner tone="success" icon="bolt" title={t('Trigger trg_auto_teammate vừa tạo {n} kết nối Đồng đội', { n: lastResult.new_teammate_edge_count })} onClose={() => setLastResult(null)}>
          {lastResult.new_teammate_edges.slice(0, 4).map((e) => `${e.from_name} → ${e.to_name}`).join(', ')}
          {lastResult.new_teammate_edges.length > 4 && ` ${t('và {n} cặp khác', { n: lastResult.new_teammate_edges.length - 4 })}`}
        </Banner>
      )}
      <section className="panel panel-flush">
        <div className="panel-head padded">
          <h2 className="t-h4">{t('Thành viên')} <span className="muted lk-num">{members.data?.length ?? ''}</span></h2>
          <SegmentedControl size="sm" label={t('Nhóm theo')} value={view} onChange={setView} options={[{ value: 'role', label: t('Theo vai trò') }, { value: 'name', label: t('Theo tên') }]} />
        </div>
        {members.loading ? (
          <>
            <LoadingNote slow={members.slow} />
            <SkeletonList count={5} />
          </>
        ) : members.error ? (
          <ErrorState error={members.error} onRetry={members.refetch} />
        ) : !members.data?.length ? (
          <EmptyState compact icon="users" title={t('Dự án chưa có thành viên')} description={t('Thêm người vào dự án; Linko tự tạo kết nối Đồng đội giữa các thành viên.')} action={writer && !closed ? t('Thêm thành viên') : undefined} onAction={() => setDialog({ kind: 'add' })} />
        ) : (
          grouped.map((g) => (
            <div key={g.key} className="member-group">
              {view === 'role' && <h3 className="member-group-title">{t(ROLE_LABEL[g.key] || g.key)}</h3>}
              <ul className="row-list padded">
                {g.items.map((m) => (
                  <li key={m.employee_id} className="row-item">
                    <Avatar id={m.employee_id} name={m.full_name} size="sm" />
                    <span className="row-text">
                      <Link to={`/people/${m.employee_id}`} className="t-label truncate">{m.full_name}</Link>
                      <span className="muted t-caption truncate">{[m.title, m.join_date ? t('từ {date}', { date: formatDate(m.join_date, lang) }) : null].filter(Boolean).join(', ')}</span>
                    </span>
                    {writer ? (
                      <select className="input select select-sm role-select" value={ROLES.includes(m.role) ? m.role : 'MEMBER'} onChange={(e) => changeRole(m, e.target.value)} aria-label={t('Vai trò của {name}', { name: m.full_name })}>
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {t(ROLE_LABEL[r])}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="badge badge-neutral badge-sm">{t(ROLE_LABEL[m.role] || m.role)}</span>
                    )}
                    {can.remove(role) && (
                      <button type="button" className="ibtn ibtn-ghost ibtn-sm" aria-label={t('Gỡ {name} khỏi dự án', { name: m.full_name })} title={t('Gỡ khỏi dự án')} onClick={() => setDialog({ kind: 'remove', member: m })}>
                        <Icon name="xmark" size={14} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>

      <Dialog
        open={dialog?.kind === 'add'}
        onClose={() => setDialog(null)}
        title={t('Thêm thành viên')}
        description={t('Người được thêm sẽ tự thành Đồng đội với mọi thành viên hiện có (trigger trg_auto_teammate).')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              {t('Huỷ')}
            </Button>
            <Button variant="primary" onClick={addMember} state={addState} disabled={!add.employee}>
              {t('Thêm vào dự án')}
            </Button>
          </>
        }
      >
        <div className="form-stack">
          {addError && (
            <Banner tone="danger" title={addError.title}>
              {addError.message}
            </Banner>
          )}
          <PersonPicker label={t('Nhân viên')} value={add.employee} onChange={(v) => setAdd((a) => ({ ...a, employee: v }))} excludeIds={(members.data || []).map((m) => m.employee_id)} required />
          <Select label={t('Vai trò')} value={add.role} onChange={(e) => setAdd((a) => ({ ...a, role: e.target.value }))} options={ROLES.map((r) => ({ value: r, label: t(ROLE_LABEL[r]) }))} />
        </div>
      </Dialog>
      <ConfirmDialog
        open={dialog?.kind === 'remove'}
        onClose={() => setDialog(null)}
        onConfirm={() => removeMember(dialog.member)}
        title={t('Gỡ {name} khỏi dự án?', { name: dialog?.member?.full_name })}
        description={t('Kết nối Đồng đội do dự án này sinh ra sẽ bị xoá nếu hai người không còn dự án chung nào khác.')}
        confirmLabel={t('Gỡ khỏi dự án')}
      />
      <ProjectForm open={dialog?.kind === 'edit'} project={p} onClose={() => setDialog(null)} />
      <DeleteProject open={dialog?.kind === 'delete'} project={p} onClose={() => setDialog(null)} onDone={() => navigate('/projects')} />
    </div>
  );
}
