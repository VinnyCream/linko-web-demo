import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import Avatar, { AvatarStack } from '../components/Avatar.jsx';
import Icon from '../components/Icon.jsx';
import { Button } from '../components/Button.jsx';
import { Select, Tabs, TextField } from '../components/Form.jsx';
import { StatusBadge } from '../components/Badge.jsx';
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
import { fold, formatDate, formatNumber } from '../lib/format.js';
import { describeError } from '../lib/errors.js';
import { useErrorToast, useToast } from '../components/Toast.jsx';
import NotFound from './errors/NotFound.jsx';

function refreshDepartments() {
  invalidate('departments', 'dept:', 'employees', 'projects', 'stats', 'audit', 'graph');
}

function DepartmentForm({ open, onClose, department }) {
  const t = useT();
  const toast = useToast();
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [error, setError] = useState(null);
  const [state, setState] = useState(null);
  useEffect(() => {
    if (open) {
      setName(department?.department_name || '');
      setLocation(department?.location || '');
      setError(null);
    }
  }, [open, department]);
  const submit = async (e) => {
    e?.preventDefault();
    if (!name.trim()) {
      setError({ field: t('Nhập tên phòng ban.') });
      return;
    }
    setState('loading');
    try {
      if (department) await api.updateDepartment(department.department_id, { department_name: name.trim(), location: location.trim() || null });
      else await api.createDepartment({ department_name: name.trim(), ...(location.trim() ? { location: location.trim() } : {}) });
      refreshDepartments();
      toast.show({ tone: 'success', title: department ? t('Đã lưu thay đổi') : t('Đã tạo phòng ban {name}', { name: name.trim() }) });
      onClose();
    } catch (err) {
      setError({ banner: describeError(err, t) });
    } finally {
      setState(null);
    }
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={department ? t('Sửa phòng ban') : t('Tạo phòng ban')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('Huỷ')}
          </Button>
          <Button variant="primary" onClick={submit} state={state}>
            {department ? t('Lưu thay đổi') : t('Tạo phòng ban')}
          </Button>
        </>
      }
    >
      <form className="form-stack" onSubmit={submit} noValidate>
        {error?.banner && (
          <Banner tone="danger" title={error.banner.title}>
            {error.banner.message}
          </Banner>
        )}
        <TextField label={t('Tên phòng ban')} required value={name} onChange={(e) => setName(e.target.value)} error={error?.field} maxLength={100} placeholder={t('Ví dụ: Phòng Pháp chế')} />
        <TextField label={t('Địa điểm')} value={location} onChange={(e) => setLocation(e.target.value)} maxLength={100} placeholder={t('Ví dụ: Tầng 9 - HQ')} />
      </form>
    </Dialog>
  );
}

// Xoá phòng ban: backend chặn khi còn nhân sự hoặc dự án, nên luồng là chuyển dữ liệu trước rồi xoá.
function DeleteDepartment({ open, onClose, department, onDone }) {
  const t = useT();
  const { departments } = usePeople();
  const toast = useToast();
  const showError = useErrorToast();
  const { role } = useSession();
  const [impact, setImpact] = useState(null);
  const [loading, setLoading] = useState(false);
  const [target, setTarget] = useState('');
  const [state, setState] = useState(null);
  useEffect(() => {
    if (!open || !department) return;
    setTarget('');
    setLoading(true);
    api.departmentImpact(department.department_id).then(setImpact).catch(showError).finally(() => setLoading(false));
  }, [open, department]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!department) return null;
  const deps = impact?.dependencies || {};
  const needsTransfer = impact?.has_dependencies;
  const confirm = async () => {
    setState('loading');
    try {
      if (needsTransfer) {
        const res = await api.transferDepartment(department.department_id, { target_department_id: Number(target), move_employees: true, move_projects: true });
        toast.show({ tone: 'success', title: t('Đã chuyển {e} nhân viên và {p} dự án', { e: res.moved_employees, p: res.moved_projects }) });
      }
      if (can.remove(role)) {
        await api.deleteDepartment(department.department_id);
        toast.show({ tone: 'success', title: t('Đã xoá {name}', { name: department.department_name }) });
        onDone?.();
      }
      refreshDepartments();
      onClose();
    } catch (err) {
      showError(err);
    } finally {
      setState(null);
    }
  };
  const canDelete = can.remove(role);
  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={confirm}
      state={state}
      impactLoading={loading}
      title={canDelete ? t('Xoá {name}?', { name: department.department_name }) : t('Chuyển dữ liệu khỏi {name}', { name: department.department_name })}
      description={needsTransfer ? t('Phòng ban còn dữ liệu. Chọn phòng nhận để chuyển toàn bộ nhân sự và dự án trước khi xoá.') : t('Phòng ban trống, xoá được ngay. Thao tác không thể hoàn tác.')}
      impact={impact ? [{ label: t('Nhân viên'), count: deps.employees ?? 0, icon: 'users' }, { label: t('Dự án'), count: deps.projects ?? 0, icon: 'folder' }] : null}
      confirmLabel={needsTransfer ? (canDelete ? t('Chuyển rồi xoá') : t('Chuyển dữ liệu')) : t('Xoá phòng ban')}
      confirmText={canDelete ? department.department_name : undefined}
      disabled={Boolean(needsTransfer && !target)}
    >
      {needsTransfer && (
        <Select
          label={t('Phòng ban nhận')}
          required
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          options={[{ value: '', label: t('Chọn phòng ban') }, ...departments.filter((d) => d.department_id !== department.department_id).map((d) => ({ value: d.department_id, label: d.department_name }))]}
        />
      )}
      {needsTransfer && !target && <p className="field-hint">{t('Cần chọn phòng ban nhận để tiếp tục.')}</p>}
    </ConfirmDialog>
  );
}

export function DepartmentList() {
  const t = useT();
  const { lang } = usePrefs();
  const { role } = useSession();
  const q = useQuery('departments:stats', () => Promise.all([api.departments(), api.departmentStats()]).then(([a, b]) => a.map((d) => ({ ...d, project_count: b.find((x) => x.department_id === d.department_id)?.project_count ?? 0 }))));
  const people = useQuery('employees:all', () => api.employees({ status: 'ALL', limit: 500 }));
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState(null);
  const rows = useMemo(() => (q.data || []).filter((d) => !search || fold(`${d.department_name} ${d.location}`).includes(fold(search))), [q.data, search]);
  const max = Math.max(1, ...rows.map((d) => d.active_count));
  return (
    <div className="page">
      <PageHeader
        title={t('Phòng ban')}
        crumbs={[{ label: t('Tổ chức') }, { label: t('Phòng ban') }]}
        description={q.data ? t('{n} phòng ban và chi nhánh.', { n: q.data.length }) : null}
        actions={can.write(role) && (
          <Button variant="primary" iconStart="plus" onClick={() => setDialog({ kind: 'create' })}>
            {t('Tạo phòng ban')}
          </Button>
        )}
      />
      <div className="toolbar">
        <div className="input-wrap has-icon toolbar-search">
          <Icon name="magnifying-glass" size={14} className="input-icon" />
          <input className="input" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('Tìm phòng ban hoặc địa điểm')} aria-label={t('Tìm phòng ban')} />
        </div>
      </div>
      {q.loading ? (
        <div className="dept-grid">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="dept-tile">
              <Skeleton width="60%" />
              <Skeleton width="35%" />
              <Skeleton variant="block" height="8px" />
            </div>
          ))}
          <LoadingNote slow={q.slow} />
        </div>
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={q.refetch} />
      ) : rows.length === 0 ? (
        <EmptyState variant="search" title={t('Không tìm thấy “{q}”', { q: search })} description={t('Thử tên phòng ban như Phòng Tài chính.')} />
      ) : (
        <ul className="dept-grid">
          {rows.map((d) => {
            const members = (people.data || []).filter((p) => p.department_id === d.department_id && p.status === 'ACTIVE');
            return (
              <li key={d.department_id} className="dept-tile">
                <div className="dept-top">
                  <Link to={`/departments/${d.department_id}`} className="dept-name">{d.department_name}</Link>
                  {can.write(role) && (
                    <Menu
                      label={t('Thao tác phòng ban')}
                      trigger={(props) => (
                        <button type="button" className="ibtn ibtn-ghost ibtn-sm" aria-label={t('Thao tác với {name}', { name: d.department_name })} {...props}>
                          <Icon name="ellipsis" size={16} />
                        </button>
                      )}
                      items={[
                        { id: 'edit', label: t('Sửa phòng ban'), icon: 'pen', onSelect: () => setDialog({ kind: 'edit', dept: d }) },
                        { id: 'del', label: can.remove(role) ? t('Xoá phòng ban') : t('Chuyển dữ liệu'), icon: can.remove(role) ? 'trash-can' : 'arrow-right', tone: can.remove(role) ? 'danger' : undefined, onSelect: () => setDialog({ kind: 'delete', dept: d }) },
                      ]}
                    />
                  )}
                </div>
                <p className="muted t-ui dept-loc">
                  <Icon name="map" size={12} />
                  {d.location || t('Chưa có địa điểm')}
                </p>
                <div className="dept-bar" aria-hidden="true">
                  <span style={{ '--pct': `${(d.active_count / max) * 100}%` }} />
                </div>
                <p className="dept-stats t-ui">
                  <span>
                    <strong className="lk-num">{formatNumber(d.active_count, lang)}</strong> {t('đang làm việc')}
                  </span>
                  <span>
                    <strong className="lk-num">{d.project_count}</strong> {t('dự án')}
                  </span>
                </p>
                <AvatarStack people={members.map((p) => ({ id: p.employee_id, name: p.full_name }))} max={4} size="sm" />
              </li>
            );
          })}
        </ul>
      )}
      <DepartmentForm open={dialog?.kind === 'create' || dialog?.kind === 'edit'} department={dialog?.kind === 'edit' ? dialog.dept : null} onClose={() => setDialog(null)} />
      <DeleteDepartment open={dialog?.kind === 'delete'} department={dialog?.dept} onClose={() => setDialog(null)} />
    </div>
  );
}

export function DepartmentDetail() {
  const t = useT();
  const { lang } = usePrefs();
  const { id } = useParams();
  const navigate = useNavigate();
  const { role } = useSession();
  const dept = useQuery(`dept:${id}`, () => api.department(id));
  const emps = useQuery(`dept:${id}:employees`, () => api.departmentEmployees(id));
  const projs = useQuery(`dept:${id}:projects`, () => api.departmentProjects(id));
  const [tab, setTab] = useState('people');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState(null);
  const people = useMemo(() => (emps.data || []).filter((p) => !search || fold(`${p.full_name} ${p.title}`).includes(fold(search))), [emps.data, search]);
  const paged = usePaged(people, page, 12);
  if (dept.error?.status === 404) return <NotFound what={t('phòng ban này')} />;
  const d = dept.data;
  const active = (emps.data || []).filter((p) => p.status === 'ACTIVE').length;
  return (
    <div className="page">
      <PageHeader
        title={d?.department_name || t('Phòng ban')}
        crumbs={[{ label: t('Phòng ban'), to: '/departments' }, { label: d?.department_name || '...' }]}
        description={d ? [d.location, t('{n} người đang làm việc', { n: active })].filter(Boolean).join('. ') : null}
        actions={
          d && (
            <>
              <Button iconStart="map" onClick={() => navigate(`/network?mode=overview`)}>
                {t('Xem trên bản đồ')}
              </Button>
              {can.write(role) && (
                <Button iconStart="pen" onClick={() => setDialog('edit')}>
                  {t('Sửa')}
                </Button>
              )}
              {can.write(role) && (
                <Button variant="ghost" iconStart={can.remove(role) ? 'trash-can' : 'arrow-right'} onClick={() => setDialog('delete')}>
                  {can.remove(role) ? t('Xoá') : t('Chuyển dữ liệu')}
                </Button>
              )}
            </>
          )
        }
      />
      {dept.error && <ErrorState error={dept.error} onRetry={dept.refetch} />}
      <Tabs
        label={t('Nội dung phòng ban')}
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'people', label: t('Nhân sự'), icon: 'users', count: emps.data?.length },
          { value: 'projects', label: t('Dự án'), icon: 'folder', count: projs.data?.length },
        ]}
      />
      {tab === 'people' ? (
        <>
          <div className="toolbar">
            <div className="input-wrap has-icon toolbar-search">
              <Icon name="magnifying-glass" size={14} className="input-icon" />
              <input className="input" type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={t('Tìm trong phòng ban')} aria-label={t('Tìm trong phòng ban')} />
            </div>
          </div>
          <section className="panel panel-flush">
            {emps.loading ? (
              <SkeletonList count={6} />
            ) : emps.error ? (
              <ErrorState error={emps.error} onRetry={emps.refetch} />
            ) : people.length === 0 ? (
              <EmptyState compact icon="users" title={search ? t('Không có ai khớp') : t('Phòng ban chưa có nhân sự')} description={search ? t('Thử tên khác.') : t('Thêm nhân viên từ Danh bạ và chọn phòng ban này.')} />
            ) : (
              <ul className="people-grid">
                {paged.slice.map((p) => (
                  <li key={p.employee_id} className="person-tile">
                    <Avatar id={p.employee_id} name={p.full_name} size="lg" presence={p.status === 'ACTIVE' ? undefined : false} />
                    <Link to={`/people/${p.employee_id}`} className="person-name">{p.full_name}</Link>
                    <span className="muted t-caption person-sub">{p.title}</span>
                    {p.status !== 'ACTIVE' && <StatusBadge status={p.status} />}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <Pagination page={paged.page} pageCount={paged.pageCount} total={paged.total} size={12} onPage={setPage} />
        </>
      ) : (
        <section className="panel panel-flush">
          {projs.loading ? (
            <SkeletonList count={4} />
          ) : !projs.data?.length ? (
            <EmptyState compact icon="folder" title={t('Chưa có dự án')} description={t('Dự án do phòng ban này phụ trách sẽ hiện ở đây.')} />
          ) : (
            <ul className="row-list padded">
              {projs.data.map((p) => (
                <li key={p.project_id} className="row-item">
                  <span className="row-icon" aria-hidden="true">
                    <Icon name="folder" size={16} />
                  </span>
                  <span className="row-text">
                    <Link to={`/projects/${p.project_id}`} className="t-label truncate">{p.project_name}</Link>
                    <span className="muted t-caption">{p.start_date ? t('Bắt đầu {date}', { date: formatDate(p.start_date, lang) }) : t('Chưa có ngày bắt đầu')}</span>
                  </span>
                  <StatusBadge kind="project" status={p.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      <DepartmentForm open={dialog === 'edit'} department={d} onClose={() => setDialog(null)} />
      <DeleteDepartment open={dialog === 'delete'} department={d} onClose={() => setDialog(null)} onDone={() => navigate('/departments')} />
    </div>
  );
}
