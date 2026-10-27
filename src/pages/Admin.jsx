import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import Icon from '../components/Icon.jsx';
import { Button } from '../components/Button.jsx';
import { Select } from '../components/Form.jsx';
import { Badge } from '../components/Badge.jsx';
import { Banner, EmptyState, ErrorState, LoadingNote, Skeleton, SkeletonList } from '../components/Feedback.jsx';
import Pagination, { usePaged } from '../components/Pagination.jsx';
import { usePrefs, useT } from '../state/prefs.jsx';
import { useQuery } from '../hooks/useQuery.js';
import { api } from '../api/endpoints.js';
import { getApiConfig } from '../api/client.js';
import { fold, formatDateTime, relTime } from '../lib/format.js';
import { describeError } from '../lib/errors.js';

const ACTION = { INSERT: ['success', 'plus', 'Thêm'], UPDATE: ['primary', 'pen', 'Sửa'], DELETE: ['danger', 'trash-can', 'Xoá'] };
const TABLE = { KNOWS: 'Kết nối', EMPLOYEES: 'Nhân viên', DEPARTMENTS: 'Phòng ban', PROJECTS: 'Dự án', PROJECT_MEMBERS: 'Thành viên dự án', REPORTS_TO: 'Quan hệ báo cáo' };

function Diff({ oldValue, newValue }) {
  const t = useT();
  if (!oldValue && !newValue) return <span className="muted">-</span>;
  return (
    <span className="diff">
      {oldValue && <del title={t('Giá trị cũ')}>{oldValue}</del>}
      {newValue && <ins title={t('Giá trị mới')}>{newValue}</ins>}
    </span>
  );
}

export function AuditLogPage() {
  const t = useT();
  const { lang } = usePrefs();
  const [action, setAction] = useState('');
  const [table, setTable] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(20);
  const q = useQuery(`audit:${action}`, () => api.auditLogs({ limit: 500, action: action || undefined }));
  const rows = useMemo(() => (q.data || []).filter((r) => !table || r.table_name === table).filter((r) => !search || fold(`${r.record_id} ${r.old_value} ${r.new_value} ${r.changed_by}`).includes(fold(search))), [q.data, table, search]);
  const paged = usePaged(rows, page, size);
  const tables = [...new Set((q.data || []).map((r) => r.table_name).filter(Boolean))];
  return (
    <div className="page">
      <PageHeader
        title={t('Nhật ký thay đổi')}
        crumbs={[{ label: t('Quản trị') }, { label: t('Nhật ký thay đổi') }]}
        description={t('Mọi thay đổi dữ liệu do trigger Oracle ghi lại, mới nhất ở trên. Người thực hiện lấy từ CLIENT_IDENTIFIER của phiên.')}
        actions={<Button iconStart="rotate-right" onClick={q.refetch}>{t('Làm mới')}</Button>}
      />
      <div className="toolbar">
        <div className="input-wrap has-icon toolbar-search">
          <Icon name="magnifying-glass" size={14} className="input-icon" />
          <input className="input" type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={t('Tìm theo mã bản ghi, giá trị, người thực hiện')} aria-label={t('Tìm trong nhật ký')} />
        </div>
        <Select className="toolbar-select" aria-label={t('Hành động')} value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} options={[{ value: '', label: t('Mọi hành động') }, ...Object.entries(ACTION).map(([k, v]) => ({ value: k, label: t(v[2]) }))]} />
        <Select className="toolbar-select" aria-label={t('Bảng')} value={table} onChange={(e) => { setTable(e.target.value); setPage(1); }} options={[{ value: '', label: t('Mọi bảng') }, ...tables.map((x) => ({ value: x, label: t(TABLE[x] || x) }))]} />
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
          <EmptyState icon="file-lines" title={t('Không có bản ghi nhật ký khớp')} description={t('Thử bỏ bộ lọc. Nhật ký chỉ có khi dữ liệu được thêm, sửa hoặc xoá.')} />
        ) : (
          <div className="table-wrap">
            <table className="table table-audit">
              <caption className="sr-only">{t('Nhật ký thay đổi')}</caption>
              <thead>
                <tr>
                  <th className="col-sticky">{t('Thời điểm')}</th>
                  <th>{t('Hành động')}</th>
                  <th>{t('Bảng')}</th>
                  <th>{t('Bản ghi')}</th>
                  <th>{t('Thay đổi')}</th>
                  <th>{t('Người thực hiện')}</th>
                </tr>
              </thead>
              <tbody>
                {paged.slice.map((r) => {
                  const [tone, icon, label] = ACTION[r.action] || ['neutral', 'circle', r.action];
                  return (
                    <tr key={r.log_id}>
                      <td className="col-sticky">
                        <time dateTime={r.changed_at} title={formatDateTime(r.changed_at, lang)} className="nowrap">{relTime(r.changed_at, lang)}</time>
                      </td>
                      <td><Badge tone={tone} icon={icon}>{t(label)}</Badge></td>
                      <td className="nowrap">{t(TABLE[r.table_name] || r.table_name)}</td>
                      <td><code className="t-mono-sm">{r.record_id}</code></td>
                      <td className="cell-diff"><Diff oldValue={r.old_value} newValue={r.new_value} /></td>
                      <td><code className="t-mono-sm">{r.changed_by}</code></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <Pagination page={paged.page} pageCount={paged.pageCount} total={paged.total} size={size} onPage={setPage} onSize={(s) => { setSize(s); setPage(1); }} />
    </div>
  );
}

export function IntegrityPage() {
  const t = useT();
  const q = useQuery('graph:integrity', () => api.integrity());
  const d = q.data;
  const ok = d?.status === 'ok';
  return (
    <div className="page page-narrow">
      <PageHeader
        title={t('Kiểm tra toàn vẹn')}
        crumbs={[{ label: t('Quản trị') }, { label: t('Kiểm tra toàn vẹn') }]}
        description={t('So khớp kết nối Đồng đội tự sinh với dữ liệu thành viên dự án.')}
        actions={<Button iconStart="rotate-right" onClick={q.refetch} state={q.refreshing ? 'loading' : undefined}>{t('Kiểm tra lại')}</Button>}
      />
      {q.loading ? (
        <section className="panel">
          <LoadingNote slow={q.slow} lines={['Đang so khớp project_members với knows...', 'Kiểm tra từng cặp đồng đội, chờ chút nhé.']} />
          <Skeleton lines={4} />
        </section>
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={q.refetch} />
      ) : (
        <>
          <section className={`verdict ${ok ? 'is-ok' : 'is-warn'}`}>
            <span className="verdict-icon" aria-hidden="true">
              <Icon name={ok ? 'circle-check' : 'triangle-exclamation'} size={22} filled />
            </span>
            <div>
              <h2 className="t-h3">{ok ? t('Dữ liệu đồng đội đang khớp') : t('Cần đồng bộ lại kết nối Đồng đội')}</h2>
              <p className="muted">{ok ? t('Mọi cặp cùng dự án đều có kết nối, không có kết nối tự sinh nào bị bỏ lại.') : t('Có kết nối thiếu hoặc thừa so với thành viên dự án hiện tại.')}</p>
            </div>
          </section>
          <section className="metrics">
            <div className="metric">
              <span className="metric-label">{t('Kết nối tự sinh đã lỗi thời')}</span>
              <span className="metric-value lk-num">{d.stale_auto_teammate_edges}</span>
              <span className="metric-helper">{t('TEAMMATE còn lại dù hai người không còn dự án chung')}</span>
            </div>
            <div className="metric">
              <span className="metric-label">{t('Cặp cùng dự án chưa có kết nối')}</span>
              <span className="metric-value lk-num">{d.missing_shared_project_edges}</span>
              <span className="metric-helper">{t('Lẽ ra trigger phải tạo TEAMMATE')}</span>
            </div>
          </section>
          {d.repair_sql && (
            <Banner tone="warning" title={t('Cách sửa')}>
              {t('Nhóm backend chạy script sau bằng schema sở hữu đồ thị:')} <code className="t-mono">@{d.repair_sql}</code>
            </Banner>
          )}
        </>
      )}
    </div>
  );
}

function Check({ label, run }) {
  const t = useT();
  const [state, setState] = useState({ status: 'idle' });
  const go = async () => {
    setState({ status: 'loading' });
    const start = performance.now();
    try {
      const data = await run();
      setState({ status: 'ok', ms: Math.round(performance.now() - start), data });
    } catch (error) {
      setState({ status: 'fail', ms: Math.round(performance.now() - start), error });
    }
  };
  useEffect(() => {
    go();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const info = state.error ? describeError(state.error, t) : null;
  return (
    <li className={`check check-${state.status}`}>
      <span className="check-icon" aria-hidden="true">
        {state.status === 'loading' || state.status === 'idle' ? <span className="spinner" /> : <Icon name={state.status === 'ok' ? 'circle-check' : 'circle-xmark'} size={18} filled />}
      </span>
      <span className="row-text">
        <span className="t-label">{label}</span>
        <span className="muted t-caption">
          {state.status === 'ok' && `${t('Ổn')}, ${state.ms} ms${state.data?.status ? `, ${state.data.status}` : ''}${state.data?.database ? `, ${state.data.database}` : ''}${state.data?.property_graph ? `, ${state.data.property_graph}` : ''}`}
          {state.status === 'fail' && `${info.title}. ${info.message}`}
          {(state.status === 'loading' || state.status === 'idle') && t('Đang kiểm tra...')}
        </span>
      </span>
      <Button size="sm" variant="ghost" onClick={go} disabled={state.status === 'loading'}>
        {t('Thử lại')}
      </Button>
    </li>
  );
}

export function SystemPage() {
  const t = useT();
  const cfg = getApiConfig();
  const [key, setKey] = useState(0);
  return (
    <div className="page page-narrow">
      <PageHeader
        title={t('Tình trạng hệ thống')}
        crumbs={[{ label: t('Quản trị') }, { label: t('Tình trạng hệ thống') }]}
        description={t('Ba lớp kiểm tra của backend: tiến trình FastAPI, kết nối Oracle, và schema cùng property graph.')}
        actions={<Button iconStart="rotate-right" onClick={() => setKey((k) => k + 1)}>{t('Kiểm tra lại tất cả')}</Button>}
      />
      <section className="panel">
        <ul className="checks" key={key}>
          <Check label={t('Tiến trình API (GET /api/live)')} run={api.live} />
          <Check label={t('Kết nối Oracle 23ai (GET /api/health)')} run={api.health} />
          <Check label={t('Schema, trigger và property graph (GET /api/ready)')} run={api.ready} />
        </ul>
      </section>
      <section className="panel">
        <h2 className="t-h4 panel-title">{t('Cấu hình phía trình duyệt')}</h2>
        <dl className="kv">
          <div>
            <dt>{t('Chế độ')}</dt>
            <dd>{cfg.mode === 'demo' ? t('Bản demo (mock server cùng hợp đồng API)') : t('API thật')}</dd>
          </div>
          <div>
            <dt>{t('Địa chỉ API')}</dt>
            <dd><code className="t-mono-sm">{cfg.base || (cfg.mode === 'demo' ? t('không dùng') : window.location.origin)}</code></dd>
          </div>
          <div>
            <dt>{t('Chủ thể token')}</dt>
            <dd><code className="t-mono-sm">{cfg.principal?.subject}</code></dd>
          </div>
          <div>
            <dt>{t('Vai trò')}</dt>
            <dd>{cfg.principal?.role}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
