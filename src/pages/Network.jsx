import { useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import NetworkGraph, { EDGE_LEGEND } from '../components/NetworkGraph.jsx';
import Avatar from '../components/Avatar.jsx';
import Icon from '../components/Icon.jsx';
import { Button } from '../components/Button.jsx';
import { PersonPicker, SegmentedControl, Select } from '../components/Form.jsx';
import { Banner, EmptyState, ErrorState, LoadingNote } from '../components/Feedback.jsx';
import { Link, useLocation, useNavigate } from '../lib/router.jsx';
import { useT } from '../state/prefs.jsx';
import { useSession } from '../auth/session.jsx';
import { usePeople } from '../state/people.jsx';
import { useQuery } from '../hooks/useQuery.js';
import { api } from '../api/endpoints.js';
import { fold } from '../lib/format.js';

const GRAPH_LINES = ['Đang dựng mạng lưới từ SQL Property Graph...', 'Đang tính vị trí cho từng người trên bản đồ.', 'Mạng hơi dày nên cần thêm vài giây, chờ chút nhé.', 'Sắp xong rồi.'];

export default function Network() {
  const t = useT();
  const location = useLocation();
  const navigate = useNavigate();
  const { me } = useSession();
  const { departments, byId } = usePeople();
  const [mode, setMode] = useState(location.query.get('mode') || 'khops');
  const [center, setCenter] = useState(Number(location.query.get('center')) || me?.employee_id || 1);
  const [k, setK] = useState(2);
  const [dept, setDept] = useState('');
  const [selected, setSelected] = useState(null);
  const [hidden, setHidden] = useState(new Set());
  const [filter, setFilter] = useState('');

  const q = useQuery(
    mode === 'khops' ? `graph:khops:${center}:${k}` : `graph:overview:${dept || 'all'}`,
    () => (mode === 'khops' ? api.khops(center, k) : api.overview({ department_id: dept || undefined, limit: 300 })),
    { slowMs: 1200 },
  );
  const elements = q.data?.elements;
  const centerKey = mode === 'khops' ? `emp_${center}` : null;
  const nodes = useMemo(() => (elements?.nodes || []).map((n) => n.data), [elements]);
  const listed = useMemo(() => {
    const f = fold(filter);
    return nodes.filter((n) => !f || fold(n.label).includes(f)).sort((a, b) => (a.hops ?? 9) - (b.hops ?? 9) || String(a.label).localeCompare(String(b.label), 'vi'));
  }, [nodes, filter]);
  const sel = selected ? nodes.find((n) => n.id === selected) : null;
  const selId = sel ? Number(sel.raw_id ?? sel.employee_id ?? String(sel.id).replace('emp_', '')) : null;
  const selPerson = selId ? byId.get(selId) : null;

  const toggleType = (key) => setHidden((s) => {
    const next = new Set(s);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });

  return (
    <div className="page page-wide">
      <PageHeader
        title={t('Bản đồ mạng lưới')}
        crumbs={[{ label: t('Mạng lưới') }, { label: t('Bản đồ mạng lưới') }]}
        description={t('Ai làm việc với ai, nhìn bằng đồ thị. Mỗi chấm là một người, mỗi đường là một quan hệ trong Oracle Property Graph.')}
      />
      <div className="toolbar graph-toolbar">
        <SegmentedControl
          label={t('Chế độ xem')}
          value={mode}
          onChange={(v) => {
            setMode(v);
            setSelected(null);
          }}
          options={[
            { value: 'khops', label: t('Quanh một người'), icon: 'circle-nodes' },
            { value: 'overview', label: t('Toàn công ty'), icon: 'globe' },
          ]}
        />
        {mode === 'khops' ? (
          <>
            <div className="toolbar-picker">
              <PersonPicker value={center} onChange={(v) => v && (setCenter(v), setSelected(null))} placeholder={t('Chọn người làm tâm')} />
            </div>
            <SegmentedControl
              label={t('Số bậc')}
              value={String(k)}
              onChange={(v) => setK(Number(v))}
              options={[
                { value: '1', label: t('1 bậc') },
                { value: '2', label: t('2 bậc') },
                { value: '3', label: t('3 bậc') },
              ]}
            />
          </>
        ) : (
          <Select className="toolbar-select" aria-label={t('Phòng ban')} value={dept} onChange={(e) => setDept(e.target.value)} options={[{ value: '', label: t('Mọi phòng ban') }, ...departments.map((d) => ({ value: d.department_id, label: d.department_name }))]} />
        )}
      </div>

      {q.data?.truncated_edges && (
        <Banner tone="warning" title={t('Đồ thị đã được rút gọn')}>
          {t('Backend chỉ trả 5.000 cạnh đầu tiên. Lọc theo phòng ban để xem đủ.')}
        </Banner>
      )}

      <div className="graph-layout">
        <section className="panel panel-flush graph-panel" aria-busy={q.loading}>
          {q.loading ? (
            <div className="graph-loading">
              <div className="graph-skeleton" aria-hidden="true">
                {Array.from({ length: 14 }, (_, i) => (
                  <span key={i} style={{ '--x': `${15 + ((i * 37) % 70)}%`, '--y': `${12 + ((i * 53) % 76)}%`, '--d': `${i * 90}ms` }} />
                ))}
              </div>
              <LoadingNote slow={q.slow} lines={GRAPH_LINES} />
            </div>
          ) : q.error ? (
            <ErrorState error={q.error} onRetry={q.refetch} />
          ) : !nodes.length ? (
            <EmptyState icon="circle-nodes" title={t('Chưa có ai trong mạng này')} description={t('Người này chưa có kết nối hoặc phòng ban chưa có nhân viên đang làm việc.')} />
          ) : (
            <NetworkGraph elements={elements} centerId={centerKey} selectedId={selected} onSelect={(id) => setSelected(id === selected ? null : id)} colorBy={mode === 'khops' ? 'hops' : 'department'} height={560} hiddenTypes={hidden} />
          )}
        </section>

        <aside className="graph-side">
          <section className="side-block" aria-labelledby="sel-title">
            <h2 id="sel-title" className="t-h4">{sel ? t('Đang chọn') : t('Chọn một người')}</h2>
            {sel ? (
              <div className="sel-card">
                <div className="row-item">
                  <Avatar id={selId} name={sel.label} size="md" />
                  <span className="row-text">
                    <Link to={`/people/${selId}`} className="t-label truncate">{sel.label}</Link>
                    <span className="muted t-caption truncate">{sel.title || selPerson?.title}</span>
                  </span>
                </div>
                {sel.hops !== undefined && sel.hops > 0 && <p className="muted t-ui">{t('Cách tâm {n} bậc', { n: sel.hops })}</p>}
                <div className="btn-row">
                  <Button size="sm" iconStart="circle-nodes" onClick={() => { setMode('khops'); setCenter(selId); setSelected(null); }}>
                    {t('Đặt làm tâm')}
                  </Button>
                  {me && me.employee_id !== selId && (
                    <Button size="sm" variant="ghost" iconStart="compass" onClick={() => navigate(`/path?from=${me.employee_id}&to=${selId}`)}>
                      {t('Tìm đường')}
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <p className="muted t-ui">{t('Bấm vào một chấm trên đồ thị, hoặc chọn tên trong danh sách bên dưới.')}</p>
            )}
          </section>

          <section className="side-block" aria-labelledby="legend-title">
            <h2 id="legend-title" className="t-h4">{t('Loại quan hệ')}</h2>
            <ul className="legend">
              {EDGE_LEGEND.map(([key, label]) => (
                <li key={key}>
                  <button type="button" className={`legend-item${hidden.has(key) ? ' is-off' : ''}`} aria-pressed={!hidden.has(key)} onClick={() => toggleType(key)}>
                    <span className={`legend-swatch gedge-${key}`} aria-hidden="true" />
                    {t(label)}
                    <Icon name={hidden.has(key) ? 'eye-slash' : 'eye'} size={12} className="legend-eye" />
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="side-block" aria-labelledby="nodes-title">
            <div className="side-head">
              <h2 id="nodes-title" className="t-h4">{t('Danh sách người')}</h2>
              <span className="muted lk-num t-caption">{nodes.length}</span>
            </div>
            <input className="input input-sm" type="search" placeholder={t('Lọc tên')} value={filter} onChange={(e) => setFilter(e.target.value)} aria-label={t('Lọc danh sách người trên đồ thị')} />
            <ul className="node-list">
              {listed.slice(0, 60).map((n) => (
                <li key={n.id}>
                  <button type="button" className={`node-btn${selected === n.id ? ' is-on' : ''}`} onClick={() => setSelected(n.id)}>
                    <span className="truncate">{n.label}</span>
                    {n.hops !== undefined && <span className="muted t-caption">{n.hops === 0 ? t('Tâm') : t('{n} bậc', { n: n.hops })}</span>}
                  </button>
                </li>
              ))}
            </ul>
            {listed.length > 60 && <p className="muted t-caption">{t('Đang hiện 60 trong {n} người. Lọc tên để thu hẹp.', { n: listed.length })}</p>}
          </section>
        </aside>
      </div>
    </div>
  );
}
