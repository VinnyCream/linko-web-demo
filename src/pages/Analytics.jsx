import { useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import Avatar from '../components/Avatar.jsx';
import Icon from '../components/Icon.jsx';
import { Button } from '../components/Button.jsx';
import { SegmentedControl } from '../components/Form.jsx';
import { Metric } from '../components/DataBits.jsx';
import { DonutChart, StackedBar, Treemap } from '../components/Charts.jsx';
import { CONNECTION_TYPES, StatusBadge } from '../components/Badge.jsx';
import { EmptyState, ErrorState, LoadingNote, Skeleton, SkeletonList } from '../components/Feedback.jsx';
import Pagination, { usePaged } from '../components/Pagination.jsx';
import { Link, useNavigate } from '../lib/router.jsx';
import { usePrefs, useT } from '../state/prefs.jsx';
import { useQuery } from '../hooks/useQuery.js';
import { api } from '../api/endpoints.js';
import { formatDateTime, formatNumber } from '../lib/format.js';

const REL_SLOTS = [['COLLEAGUE', 1], ['MENTOR', 2], ['MENTEE', 3], ['FOLLOW', 4], ['FRIEND', 5], ['TEAMMATE', 6]];

const DASH_LINES = ['Đang tổng hợp số liệu từ 7 bảng Oracle...', 'Đếm kết nối theo từng loại và phòng ban.', 'Truy vấn tổng hợp hơi nặng, chờ thêm chút nhé.'];

export function AnalyticsOverview() {
  const t = useT();
  const { lang } = usePrefs();
  const q = useQuery('stats:dashboard', () => api.dashboard());
  const top = useQuery('stats:top', () => api.topConnectors(10));
  const d = q.data;
  const avg = d ? (d.stats.edges_knows * 2) / Math.max(1, d.stats.employees) : 0;
  const navigate = useNavigate();
  // Màu cố định theo loại kết nối (không theo thứ hạng): slot 1..6 của bảng màu biểu đồ.
  const relRows = REL_SLOTS.map(([key, slot]) => ({
    key, slot, label: t(CONNECTION_TYPES[key].label), value: (d?.relationships || []).find((r) => r.key === key)?.count || 0,
  })).filter((r) => r.value > 0 || ['COLLEAGUE', 'TEAMMATE'].includes(r.key));
  const deptRows = (d?.departments || []).map((x) => ({
    key: x.department_id, label: x.name, value: x.employee_count, sub: t('{n} dự án', { n: x.project_count }),
  }));
  const edgeRows = d ? [
    { key: 'knows', slot: 1, label: t('Kết nối (Knows)'), value: d.stats.edges_knows },
    { key: 'reports', slot: 2, label: t('Báo cáo (ReportsTo)'), value: d.stats.edges_reports_to },
    { key: 'works', slot: 3, label: t('Thành viên dự án (WorksOn)'), value: d.stats.edges_works_on },
  ] : [];

  return (
    <div className="page">
      <PageHeader
        title={t('Tổng quan mạng lưới')}
        crumbs={[{ label: t('Phân tích') }, { label: t('Tổng quan') }]}
        description={d ? t('Cập nhật lúc {time}.', { time: formatDateTime(d.generated_at, lang) }) : t('Số liệu tổng hợp trực tiếp từ Oracle 23ai.')}
        actions={
          <Button iconStart="rotate-right" onClick={() => { q.refetch(); top.refetch(); }} state={q.refreshing ? 'loading' : undefined}>
            {t('Làm mới')}
          </Button>
        }
      />
      {q.error ? (
        <ErrorState error={q.error} onRetry={q.refetch} />
      ) : (
        <>
          <p className="lead-answer">
            {d ? (
              t('{n} người đang nối với nhau bằng {k} quan hệ. Trung bình mỗi người có {a} kết nối.', { n: formatNumber(d.stats.employees, lang), k: formatNumber(d.stats.edges_knows, lang), a: formatNumber(avg, lang, 1) })
            ) : (
              <Skeleton width="70%" />
            )}
          </p>
          <LoadingNote slow={q.slow} lines={DASH_LINES} />
          <section className="metrics" aria-label={t('Chỉ số chính')}>
            <Metric label={t('Nhân viên')} value={d?.stats.employees} loading={q.loading} />
            <Metric label={t('Phòng ban')} value={d?.stats.departments} loading={q.loading} />
            <Metric label={t('Dự án')} value={d?.stats.projects} loading={q.loading} />
            <Metric label={t('Cạnh trên đồ thị')} value={d?.stats.edges_total} loading={q.loading} />
          </section>
          <section className="panel" aria-labelledby="edge-title">
            <div className="panel-head">
              <h2 id="edge-title" className="t-h4">{t('Đồ thị được tạo từ những gì')}</h2>
              {d && <span className="muted t-ui">{t('Cơ cấu {n} cạnh trong enterprise_social_graph', { n: formatNumber(d.stats.edges_total, lang) })}</span>}
            </div>
            {q.loading ? <Skeleton variant="block" height="40px" /> : <StackedBar rows={edgeRows} label={t('Cơ cấu cạnh đồ thị')} />}
          </section>
          <div className="split split-wide">
            <section className="panel" aria-labelledby="rel-title">
              <h2 id="rel-title" className="t-h4 panel-title">{t('Loại kết nối')}</h2>
              <p className="panel-sub">{d && relRows.length ? t('{type} chiếm {p} mọi quan hệ Knows.', { type: [...relRows].sort((a, b) => b.value - a.value)[0].label, p: `${formatNumber(([...relRows].sort((a, b) => b.value - a.value)[0].value / Math.max(1, d.stats.edges_knows)) * 100, lang, 0)}%` }) : ''}</p>
              {q.loading ? <Skeleton variant="circle" width="180px" height="180px" /> : <DonutChart rows={relRows} centerLabel={t('quan hệ')} title={t('Loại kết nối')} />}
            </section>
            <section className="panel" aria-labelledby="dept-title">
              <h2 id="dept-title" className="t-h4 panel-title">{t('Nhân sự theo phòng ban')}</h2>
              <p className="panel-sub">{t('Diện tích ô tỉ lệ với số nhân viên. Bấm một ô để mở phòng ban.')}</p>
              {q.loading ? <Skeleton variant="block" height="280px" /> : <Treemap rows={deptRows} label={t('Nhân sự theo phòng ban')} unit={t('nhân viên')} onSelect={(tile) => navigate(`/departments/${tile.key}`)} />}
            </section>
          </div>
          <section className="panel panel-flush" aria-labelledby="top-title">
            <div className="panel-head padded">
              <h2 id="top-title" className="t-h4">{t('Người kết nối nhiều nhất')}</h2>
              <Link to="/network?mode=overview" className="link t-ui">{t('Xem trên bản đồ')}</Link>
            </div>
            {top.loading ? (
              <SkeletonList count={5} />
            ) : top.error ? (
              <ErrorState compact error={top.error} onRetry={top.refetch} />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <caption className="sr-only">{t('Người kết nối nhiều nhất')}</caption>
                  <thead>
                    <tr>
                      <th className="num">{t('Hạng')}</th>
                      <th className="col-sticky">{t('Nhân viên')}</th>
                      <th className="hide-tablet-cell">{t('Phòng ban')}</th>
                      <th className="num">{t('Đi')}</th>
                      <th className="num">{t('Đến')}</th>
                      <th className="num">{t('Dự án')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top.data.map((p, i) => (
                      <tr key={p.employee_id}>
                        <td className="num lk-num muted">{i + 1}</td>
                        <td className="col-sticky">
                          <div className="cell-person">
                            <Avatar id={p.employee_id} name={p.full_name} size="sm" presence={false} />
                            <Link to={`/people/${p.employee_id}`} className="t-label truncate">{p.full_name}</Link>
                          </div>
                        </td>
                        <td className="hide-tablet-cell">{p.department_name}</td>
                        <td className="num lk-num">{p.outgoing}</td>
                        <td className="num lk-num">{p.incoming}</td>
                        <td className="num lk-num">{p.projects}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export function CrossDepartment() {
  const t = useT();
  const { lang } = usePrefs();
  const q = useQuery('stats:cross', () => api.crossDepartment(100));
  const depts = useQuery('departments', () => api.departments());
  const [view, setView] = useState('list');
  const [pairPageNo, setPairPageNo] = useState(1);
  const rows = q.data || [];
  const max = Math.max(1, ...rows.map((r) => r.relation_count));
  const pairPage = usePaged(rows, pairPageNo, 10);
  const matrix = useMemo(() => {
    const ds = (depts.data || []).filter((d) => rows.some((r) => r.source_department_id === d.department_id || r.target_department_id === d.department_id));
    const val = (a, b) => rows.find((r) => (r.source_department_id === a && r.target_department_id === b) || (r.source_department_id === b && r.target_department_id === a))?.relation_count || 0;
    return { ds, val };
  }, [rows, depts.data]);
  const isolated = (depts.data || []).filter((d) => !rows.some((r) => r.source_department_id === d.department_id || r.target_department_id === d.department_id));

  return (
    <div className="page">
      <PageHeader
        title={t('Liên kết liên phòng')}
        crumbs={[{ label: t('Phân tích') }, { label: t('Liên kết liên phòng') }]}
        description={t('Những phòng ban nào đang làm việc với nhau, đếm theo quan hệ Knows giữa nhân viên đang làm việc.')}
        actions={
          <SegmentedControl
            label={t('Kiểu xem')}
            value={view}
            onChange={setView}
            options={[
              { value: 'list', label: t('Xếp hạng'), icon: 'list' },
              { value: 'matrix', label: t('Ma trận'), icon: 'object-group' },
            ]}
          />
        }
      />
      {isolated.length > 0 && !q.loading && (
        <p className="hint-line">
          <Icon name="triangle-exclamation" size={14} />
          {t('{n} phòng ban chưa có kết nối nào với phòng khác: {names}.', { n: isolated.length, names: isolated.map((d) => d.department_name).join(', ') })}
        </p>
      )}
      <section className="panel">
        {q.loading ? (
          <>
            <LoadingNote slow={q.slow} />
            <Skeleton lines={8} />
          </>
        ) : q.error ? (
          <ErrorState error={q.error} onRetry={q.refetch} />
        ) : rows.length === 0 ? (
          <EmptyState icon="object-group" title={t('Chưa có liên kết liên phòng')} description={t('Khi nhân viên ở các phòng khác nhau kết nối với nhau, cặp phòng ban sẽ hiện ở đây.')} />
        ) : view === 'list' ? (
          <>
            <ol className="pair-list">
              {pairPage.slice.map((r) => (
                <li key={`${r.source_department_id}-${r.target_department_id}`} className="pair-row">
                  <span className="pair-names">
                    <Link to={`/departments/${r.source_department_id}`}>{r.source_department}</Link>
                    <Icon name="link" size={12} className="pair-link" />
                    <Link to={`/departments/${r.target_department_id}`}>{r.target_department}</Link>
                  </span>
                  <span className="pair-value lk-num">{formatNumber(r.relation_count, lang)}</span>
                  <span className="barlist-track pair-track" aria-hidden="true">
                    <span className="barlist-fill tone-primary" style={{ '--pct': `${Math.max(2, (r.relation_count / max) * 100)}%` }} />
                  </span>
                </li>
              ))}
            </ol>
            <Pagination page={pairPage.page} pageCount={pairPage.pageCount} total={pairPage.total} size={10} onPage={setPairPageNo} />
          </>
        ) : (
          <div className="table-wrap">
            <table className="heat">
              <caption className="sr-only">{t('Ma trận số kết nối giữa các phòng ban')}</caption>
              <thead>
                <tr>
                  <th className="col-sticky" />
                  {matrix.ds.map((d) => (
                    <th key={d.department_id} scope="col">
                      <span className="heat-col">{d.department_name}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.ds.map((a) => (
                  <tr key={a.department_id}>
                    <th scope="row" className="col-sticky">{a.department_name}</th>
                    {matrix.ds.map((b) => {
                      const v = a.department_id === b.department_id ? null : matrix.val(a.department_id, b.department_id);
                      return (
                        <td key={b.department_id} className={v == null ? 'is-self' : v ? 'has-value' : ''} style={{ '--heat': v ? Math.round(12 + (v / max) * 76) : 0 }} title={v == null ? '' : `${a.department_name} + ${b.department_name}: ${v}`}>
                          {v ? <span className="lk-num">{v}</span> : v == null ? '' : <span className="muted">0</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export function ProjectCollaboration() {
  const t = useT();
  const q = useQuery('stats:collab', () => api.projectCollaboration(100));
  const [page, setPage] = useState(1);
  const rows = q.data || [];
  const paged = usePaged(rows, page, 10);
  const maxDept = Math.max(1, ...rows.map((r) => r.department_count));
  const multi = rows.filter((r) => r.department_count > 1).length;
  return (
    <div className="page">
      <PageHeader
        title={t('Hợp tác dự án')}
        crumbs={[{ label: t('Phân tích') }, { label: t('Hợp tác dự án') }]}
        description={q.data ? t('{m} trên {n} dự án có thành viên từ nhiều phòng ban.', { m: multi, n: rows.length }) : t('Quy mô và mức độ liên phòng của từng dự án.')}
      />
      <section className="panel panel-flush">
        {q.loading ? (
          <>
            <LoadingNote slow={q.slow} />
            <SkeletonList count={6} />
          </>
        ) : q.error ? (
          <ErrorState error={q.error} onRetry={q.refetch} />
        ) : rows.length === 0 ? (
          <EmptyState icon="clipboard" title={t('Chưa có dự án')} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">{t('Hợp tác theo dự án')}</caption>
              <thead>
                <tr>
                  <th className="col-sticky">{t('Dự án')}</th>
                  <th>{t('Trạng thái')}</th>
                  <th className="num">{t('Thành viên')}</th>
                  <th>{t('Số phòng ban tham gia')}</th>
                </tr>
              </thead>
              <tbody>
                {paged.slice.map((r) => (
                  <tr key={r.project_id}>
                    <td className="col-sticky">
                      <Link to={`/projects/${r.project_id}`} className="t-label">{r.project_name}</Link>
                    </td>
                    <td>
                      <StatusBadge kind="project" status={r.status} />
                    </td>
                    <td className="num lk-num">{r.member_count}</td>
                    <td>
                      <span className="inline-bar">
                        <span className="barlist-track" aria-hidden="true">
                          <span className="barlist-fill tone-teammate" style={{ '--pct': `${(r.department_count / maxDept) * 100}%` }} />
                        </span>
                        <span className="lk-num">{r.department_count}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <Pagination page={paged.page} pageCount={paged.pageCount} total={paged.total} size={10} onPage={setPage} />
    </div>
  );
}
