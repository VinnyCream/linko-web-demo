import { useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import Avatar from '../components/Avatar.jsx';
import Icon from '../components/Icon.jsx';
import { Button } from '../components/Button.jsx';
import { Checkbox, SegmentedControl, Select } from '../components/Form.jsx';
import { StatusBadge, EMPLOYEE_STATUS_LABEL } from '../components/Badge.jsx';
import { EmptyState, ErrorState, LoadingNote, SkeletonList } from '../components/Feedback.jsx';
import Menu from '../components/Menu.jsx';
import Pagination, { usePaged } from '../components/Pagination.jsx';
import { Dialog } from '../components/Dialog.jsx';
import { Link, useLocation, useNavigate } from '../lib/router.jsx';
import { usePrefs, useT } from '../state/prefs.jsx';
import { usePeople } from '../state/people.jsx';
import { useSession } from '../auth/session.jsx';
import { can } from '../auth/permissions.js';
import { useQuery } from '../hooks/useQuery.js';
import { api } from '../api/endpoints.js';
import { fold, formatNumber } from '../lib/format.js';
import { readStore, writeStore } from '../lib/storage.js';
import { useErrorToast, useToast } from '../components/Toast.jsx';
import { DeleteEmployeeDialog, EmployeeFormDialog, ManagerDialog, refreshEmployees } from './EmployeeDialogs.jsx';

export default function Directory() {
  const t = useT();
  const { lang } = usePrefs();
  const location = useLocation();
  const navigate = useNavigate();
  const { role, me } = useSession();
  const { departments, presenceOf } = usePeople();
  const toast = useToast();
  const showError = useErrorToast();
  const q = useQuery('employees:all', () => api.employees({ status: 'ALL', limit: 500 }));
  const [search, setSearch] = useState(location.query.get('q') || '');
  const [dept, setDept] = useState(location.query.get('dept') || '');
  const [status, setStatus] = useState('ACTIVE');
  const [presence, setPresence] = useState(location.query.get('presence') || '');
  const [view, setView] = useState(() => readStore('directory-view', 'table'));
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' });
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(20);
  const [selected, setSelected] = useState(new Set());
  const [dialog, setDialog] = useState(null); // { kind, employee }
  const [bulkStatus, setBulkStatus] = useState('ON_LEAVE');
  const [bulkState, setBulkState] = useState(null);
  const writer = can.write(role);

  const rows = useMemo(() => {
    const f = fold(search);
    const list = (q.data || [])
      .filter((p) => !status || p.status === status)
      .filter((p) => !dept || String(p.department_id) === String(dept))
      .filter((p) => !presence || (p.status === 'ACTIVE' && presenceOf(p.employee_id) === presence))
      .filter((p) => !f || fold(`${p.full_name} ${p.title || ''} ${p.email || ''} ${p.department_name || ''}`).includes(f));
    const dir = sort.dir === 'asc' ? 1 : -1;
    const key = { name: (p) => p.full_name, title: (p) => p.title || '', dept: (p) => p.department_name || '', manager: (p) => p.manager_name || '' }[sort.key];
    return list.sort((a, b) => key(a).localeCompare(key(b), 'vi') * dir);
  }, [q.data, search, status, dept, presence, sort, presenceOf]);
  const paged = usePaged(rows, page, size);
  const resetPage = (fn) => (v) => {
    fn(v);
    setPage(1);
    setSelected(new Set());
  };

  const toggleSort = (key) => setSort((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }));
  const sortIcon = (key) => (sort.key === key ? (sort.dir === 'asc' ? 'arrow-up' : 'arrow-down') : 'sort');
  const ariaSort = (key) => (sort.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none');

  const pageIds = paged.slice.map((p) => p.employee_id);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const someOnPage = pageIds.some((id) => selected.has(id));
  const toggleAll = () => setSelected((s) => {
    const next = new Set(s);
    pageIds.forEach((id) => (allOnPage ? next.delete(id) : next.add(id)));
    return next;
  });
  const toggleOne = (id) => setSelected((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const applyBulk = async () => {
    setBulkState('loading');
    try {
      const ids = [...selected];
      const res = await api.bulkStatus(ids, bulkStatus);
      refreshEmployees();
      setSelected(new Set());
      setDialog(null);
      toast.show({ tone: 'success', title: t('Đã cập nhật trạng thái {n} nhân viên', { n: res.updated ?? ids.length }) });
    } catch (err) {
      showError(err);
    } finally {
      setBulkState(null);
    }
  };

  const rowMenu = (p) => [
    { id: 'view', label: t('Xem hồ sơ'), icon: 'circle-user', onSelect: () => navigate(`/people/${p.employee_id}`) },
    { id: 'path', label: t('Tìm đường tới người này'), icon: 'compass', onSelect: () => navigate(`/path?to=${p.employee_id}`) },
    { id: 'msg', label: t('Nhắn tin'), icon: 'comments', onSelect: () => navigate(`/messages?to=${p.employee_id}`) },
    writer && { divider: true },
    writer && { id: 'edit', label: t('Sửa thông tin'), icon: 'pen', onSelect: () => setDialog({ kind: 'edit', employee: p }) },
    writer && { id: 'mgr', label: t('Đổi quản lý trực tiếp'), icon: 'sitemap', onSelect: () => setDialog({ kind: 'manager', employee: p }) },
    writer && p.status !== 'ON_LEAVE' && { id: 'leave', label: t('Chuyển sang Nghỉ phép'), icon: 'clock', onSelect: () => api.setEmployeeStatus(p.employee_id, 'ON_LEAVE').then(() => { refreshEmployees(); toast.show({ tone: 'success', title: t('Đã cập nhật trạng thái') }); }).catch(showError) },
    writer && p.status !== 'ACTIVE' && { id: 'active', label: t('Chuyển về Đang làm việc'), icon: 'circle-check', onSelect: () => api.setEmployeeStatus(p.employee_id, 'ACTIVE').then(() => { refreshEmployees(); toast.show({ tone: 'success', title: t('Đã cập nhật trạng thái') }); }).catch(showError) },
    can.remove(role) && { divider: true },
    can.remove(role) && { id: 'del', label: t('Xoá nhân viên'), icon: 'trash-can', tone: 'danger', onSelect: () => setDialog({ kind: 'delete', employee: p }) },
  ];

  const total = q.data?.length || 0;
  return (
    <div className="page">
      <PageHeader
        title={t('Danh bạ')}
        crumbs={[{ label: t('Tổ chức') }, { label: t('Danh bạ') }]}
        description={q.data ? t('{n} người trong công ty, {a} đang làm việc.', { n: formatNumber(total, lang), a: formatNumber(q.data.filter((p) => p.status === 'ACTIVE').length, lang) }) : t('Tìm đồng nghiệp theo tên, chức danh hoặc phòng ban.')}
        actions={
          writer && (
            <Button variant="primary" iconStart="user-plus" onClick={() => setDialog({ kind: 'create' })}>
              {t('Thêm nhân viên')}
            </Button>
          )
        }
      />

      <div className="toolbar" role="search">
        <div className="input-wrap has-icon toolbar-search">
          <Icon name="magnifying-glass" size={14} className="input-icon" />
          <input
            className="input"
            type="search"
            value={search}
            onChange={(e) => resetPage(setSearch)(e.target.value)}
            placeholder={t('Tìm tên, chức danh, email')}
            aria-label={t('Tìm trong danh bạ')}
          />
        </div>
        <Select
          className="toolbar-select"
          aria-label={t('Phòng ban')}
          value={dept}
          onChange={(e) => resetPage(setDept)(e.target.value)}
          options={[{ value: '', label: t('Mọi phòng ban') }, ...departments.map((d) => ({ value: d.department_id, label: d.department_name }))]}
        />
        <Select
          className="toolbar-select"
          aria-label={t('Trạng thái')}
          value={status}
          onChange={(e) => resetPage(setStatus)(e.target.value)}
          options={[{ value: '', label: t('Mọi trạng thái') }, ...Object.entries(EMPLOYEE_STATUS_LABEL).map(([value, label]) => ({ value, label: t(label) }))]}
        />
        <Select
          className="toolbar-select"
          aria-label={t('Trực tuyến')}
          value={presence}
          onChange={(e) => resetPage(setPresence)(e.target.value)}
          options={[{ value: '', label: t('Mọi trạng thái trực tuyến') }, { value: 'online', label: t('Đang trực tuyến') }, { value: 'away', label: t('Tạm vắng') }, { value: 'offline', label: t('Ngoại tuyến') }]}
        />
        <SegmentedControl
          className="hide-mobile"
          label={t('Kiểu hiển thị')}
          value={view}
          onChange={(v) => {
            setView(v);
            writeStore('directory-view', v);
          }}
          options={[
            { value: 'table', label: t('Bảng'), icon: 'list', iconOnly: true },
            { value: 'grid', label: t('Lưới'), icon: 'users', iconOnly: true },
          ]}
        />
      </div>

      {writer && selected.size > 0 && (
        <div className="bulkbar" role="region" aria-label={t('Thao tác hàng loạt')}>
          <span className="t-label">{t('Đã chọn {n} người', { n: selected.size })}</span>
          <Button size="sm" variant="secondary" iconStart="pen" onClick={() => setDialog({ kind: 'bulk' })}>
            {t('Đổi trạng thái')}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            {t('Bỏ chọn')}
          </Button>
        </div>
      )}

      <section className="panel panel-flush" aria-busy={q.loading}>
        {q.loading ? (
          <>
            <LoadingNote slow={q.slow} />
            <SkeletonList count={8} />
          </>
        ) : q.error ? (
          <ErrorState error={q.error} onRetry={q.refetch} />
        ) : rows.length === 0 ? (
          <EmptyState
            variant="search"
            title={search ? t('Không tìm thấy “{q}”', { q: search }) : t('Không có ai khớp bộ lọc')}
            description={t('Thử tên không dấu, chức danh như "Tech Lead" hoặc chọn Mọi phòng ban.')}
            action={t('Xoá bộ lọc')}
            onAction={() => {
              setSearch('');
              setDept('');
              setStatus('');
              setPresence('');
            }}
          />
        ) : view === 'grid' ? (
          <ul className="people-grid">
            {paged.slice.map((p) => (
              <li key={p.employee_id} className="person-tile">
                <Avatar id={p.employee_id} name={p.full_name} size="lg" presence={p.status === 'ACTIVE' ? undefined : false} />
                <Link to={`/people/${p.employee_id}`} className="person-name">{p.full_name}</Link>
                <span className="muted t-caption person-sub">{p.title || t('Chưa có chức danh')}</span>
                <span className="muted t-caption person-sub">{p.department_name}</span>
                {p.status !== 'ACTIVE' && <StatusBadge status={p.status} />}
              </li>
            ))}
          </ul>
        ) : (
          <>
          <ul className="mobile-list" aria-label={t('Danh bạ nhân viên')}>
            {paged.slice.map((p) => (
              <li key={p.employee_id} className="mobile-row">
                {writer && <Checkbox aria-label={t('Chọn {name}', { name: p.full_name })} checked={selected.has(p.employee_id)} onChange={() => toggleOne(p.employee_id)} />}
                <Avatar id={p.employee_id} name={p.full_name} size="md" presence={p.status === 'ACTIVE' ? undefined : false} />
                <span className="row-text">
                  <Link to={`/people/${p.employee_id}`} className="t-label truncate">{p.full_name}</Link>
                  <span className="muted t-caption truncate">{[p.title, p.department_name].filter(Boolean).join(', ')}</span>
                  {p.status !== 'ACTIVE' && <StatusBadge status={p.status} />}
                </span>
                <Menu
                  label={t('Thao tác với {name}', { name: p.full_name })}
                  trigger={(props) => (
                    <button type="button" className="ibtn ibtn-ghost ibtn-sm" aria-label={t('Thao tác với {name}', { name: p.full_name })} {...props}>
                      <Icon name="ellipsis" size={16} />
                    </button>
                  )}
                  items={rowMenu(p)}
                />
              </li>
            ))}
          </ul>
          <div className="table-wrap dir-table">
            <table className="table">
              <caption className="sr-only">{t('Danh bạ nhân viên')}</caption>
              <thead>
                <tr>
                  {writer && (
                    <th className="col-check">
                      <Checkbox aria-label={t('Chọn tất cả trên trang')} checked={allOnPage} indeterminate={!allOnPage && someOnPage} onChange={toggleAll} />
                    </th>
                  )}
                  <th aria-sort={ariaSort('name')} className="col-sticky">
                    <button type="button" className="th-sort" onClick={() => toggleSort('name')}>
                      {t('Nhân viên')} <Icon name={sortIcon('name')} size={10} />
                    </button>
                  </th>
                  <th aria-sort={ariaSort('title')} className="hide-tablet-cell">
                    <button type="button" className="th-sort" onClick={() => toggleSort('title')}>
                      {t('Chức danh')} <Icon name={sortIcon('title')} size={10} />
                    </button>
                  </th>
                  <th aria-sort={ariaSort('dept')}>
                    <button type="button" className="th-sort" onClick={() => toggleSort('dept')}>
                      {t('Phòng ban')} <Icon name={sortIcon('dept')} size={10} />
                    </button>
                  </th>
                  <th aria-sort={ariaSort('manager')} className="hide-tablet-cell">
                    <button type="button" className="th-sort" onClick={() => toggleSort('manager')}>
                      {t('Quản lý')} <Icon name={sortIcon('manager')} size={10} />
                    </button>
                  </th>
                  <th>{t('Trạng thái')}</th>
                  <th className="col-actions">
                    <span className="sr-only">{t('Thao tác')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {paged.slice.map((p) => (
                  <tr key={p.employee_id} className={selected.has(p.employee_id) ? 'is-selected' : ''}>
                    {writer && (
                      <td className="col-check">
                        <Checkbox aria-label={t('Chọn {name}', { name: p.full_name })} checked={selected.has(p.employee_id)} onChange={() => toggleOne(p.employee_id)} />
                      </td>
                    )}
                    <td className="col-sticky">
                      <div className="cell-person">
                        <Avatar id={p.employee_id} name={p.full_name} size="sm" presence={p.status === 'ACTIVE' ? undefined : false} />
                        <span className="cell-person-text">
                          <Link to={`/people/${p.employee_id}`} className="t-label truncate">
                            {p.full_name}
                            {me?.employee_id === p.employee_id && <span className="you-tag">{t('Bạn')}</span>}
                          </Link>
                          <span className="muted t-caption truncate show-tablet-block">{p.title}</span>
                        </span>
                      </div>
                    </td>
                    <td className="hide-tablet-cell">{p.title || <span className="muted">{t('Chưa có')}</span>}</td>
                    <td>
                      {p.department_id ? <Link to={`/departments/${p.department_id}`} className="link-quiet">{p.department_name}</Link> : <span className="muted">{t('Chưa xếp')}</span>}
                    </td>
                    <td className="hide-tablet-cell">{p.manager_id ? <Link to={`/people/${p.manager_id}`} className="link-quiet">{p.manager_name}</Link> : <span className="muted">-</span>}</td>
                    <td>
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="col-actions">
                      <Menu
                        label={t('Thao tác với {name}', { name: p.full_name })}
                        trigger={(props) => (
                          <button type="button" className="ibtn ibtn-ghost ibtn-sm" aria-label={t('Thao tác với {name}', { name: p.full_name })} {...props}>
                            <Icon name="ellipsis" size={16} />
                          </button>
                        )}
                        items={rowMenu(p)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </section>
      <Pagination page={paged.page} pageCount={paged.pageCount} total={paged.total} size={size} onPage={setPage} onSize={(s) => { setSize(s); setPage(1); }} />

      <EmployeeFormDialog open={dialog?.kind === 'create' || dialog?.kind === 'edit'} employeeId={dialog?.kind === 'edit' ? dialog.employee.employee_id : null} onClose={() => setDialog(null)} onSaved={(e) => dialog?.kind === 'create' && e?.employee_id && navigate(`/people/${e.employee_id}`)} />
      <ManagerDialog open={dialog?.kind === 'manager'} employee={dialog?.employee} onClose={() => setDialog(null)} />
      <DeleteEmployeeDialog open={dialog?.kind === 'delete'} employee={dialog?.employee} onClose={() => setDialog(null)} />
      <Dialog
        open={dialog?.kind === 'bulk'}
        onClose={() => setDialog(null)}
        title={t('Đổi trạng thái {n} nhân viên', { n: selected.size })}
        description={t('Áp dụng cùng lúc, tất cả hoặc không gì cả.')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              {t('Huỷ')}
            </Button>
            <Button variant="primary" onClick={applyBulk} state={bulkState}>
              {t('Cập nhật trạng thái')}
            </Button>
          </>
        }
      >
        <Select label={t('Trạng thái mới')} value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} options={Object.entries(EMPLOYEE_STATUS_LABEL).map(([value, label]) => ({ value, label: t(label) }))} />
      </Dialog>
    </div>
  );
}
