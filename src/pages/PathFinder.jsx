import { useEffect, useRef, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import PathTrail from '../components/PathTrail.jsx';
import Icon from '../components/Icon.jsx';
import { Button, IconButton } from '../components/Button.jsx';
import { PersonPicker, Select, Switch } from '../components/Form.jsx';
import { EmptyState, ErrorState, LoadingNote } from '../components/Feedback.jsx';
import { useLocation, useNavigate } from '../lib/router.jsx';
import { useT } from '../state/prefs.jsx';
import { useSession } from '../auth/session.jsx';
import { usePeople } from '../state/people.jsx';
import { api } from '../api/endpoints.js';

const PATH_LINES = ['Đang dò đường trên đồ thị Oracle...', 'Đang so sánh các đường cùng độ dài để chọn đường ngắn nhất.', 'Mạng khá dày, chờ thêm vài giây nhé.', 'Sắp tìm xong rồi.'];

// Backend demo_presets (graph_service.py): ví dụ cố định dựa trên 02_sample_data.sql.
const PRESETS = [
  { label: 'Junior Backend tới Tổng Giám đốc', from: 20, to: 1, hops: 6, projects: false },
  { label: 'Chi nhánh Hà Nội tới Đà Nẵng', from: 53, to: 58, hops: 5, projects: true },
];

export default function PathFinder() {
  const t = useT();
  const location = useLocation();
  const navigate = useNavigate();
  const { me } = useSession();
  const { byId } = usePeople();
  const [from, setFrom] = useState(Number(location.query.get('from')) || me?.employee_id || null);
  const [to, setTo] = useState(Number(location.query.get('to')) || null);
  const [maxHops, setMaxHops] = useState(6);
  const [withProjects, setWithProjects] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [slow, setSlow] = useState(false);
  const [playKey, setPlayKey] = useState(0);
  const resultRef = useRef(null);
  const autoRan = useRef(false);

  const run = async (params) => {
    const body = { source_id: params?.from ?? from, target_id: params?.to ?? to, max_hops: params?.hops ?? maxHops, include_projects: params?.projects ?? withProjects };
    if (!body.source_id || !body.target_id) return;
    setLoading(true);
    setError(null);
    setSlow(false);
    const timer = setTimeout(() => setSlow(true), 1200);
    try {
      const res = await api.shortestPath(body);
      setResult(res);
      setPlayKey((k) => k + 1);
      navigate(`/path?from=${body.source_id}&to=${body.target_id}`, { replace: true });
      requestAnimationFrame(() => resultRef.current?.focus({ preventScroll: false }));
    } catch (err) {
      setResult(null);
      setError(err);
    } finally {
      clearTimeout(timer);
      setLoading(false);
      setSlow(false);
    }
  };

  useEffect(() => {
    if (autoRan.current) return;
    if (location.query.get('from') && location.query.get('to')) {
      autoRan.current = true;
      run();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  const fromName = byId.get(Number(result?.source_id))?.full_name;
  const toName = byId.get(Number(result?.target_id))?.full_name;

  return (
    <div className="page">
      <PageHeader
        title={t('Tìm đường kết nối')}
        crumbs={[{ label: t('Mạng lưới') }, { label: t('Tìm đường kết nối') }]}
        description={t('Tìm chuỗi người ngắn nhất nối bạn với bất kỳ ai trong công ty, qua kết nối, quan hệ báo cáo và (tuỳ chọn) dự án chung.')}
      />
      <form
        className="path-form panel"
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
      >
        <div className="path-ends">
          <PersonPicker label={t('Từ')} value={from} onChange={setFrom} excludeIds={to ? [to] : []} required />
          <IconButton icon="rotate" label={t('Đổi chiều')} onClick={swap} variant="soft" className="path-swap" />
          <PersonPicker label={t('Tới')} value={to} onChange={setTo} excludeIds={from ? [from] : []} required />
        </div>
        <div className="path-options">
          <Select
            label={t('Tối đa')}
            value={maxHops}
            onChange={(e) => setMaxHops(Number(e.target.value))}
            options={[1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: t('{n} bậc', { n }) }))}
          />
          <Switch checked={withProjects} onChange={setWithProjects} label={t('Đi qua dự án chung')} description={t('Tối đa 5 bậc khi bật')} />
          <Button type="submit" variant="primary" size="lg" iconStart="route" state={loading ? 'loading' : undefined} disabled={!from || !to}>
            {t('Tìm đường')}
          </Button>
        </div>
        <div className="presets">
          <span className="muted t-caption">{t('Thử nhanh:')}</span>
          {PRESETS.filter((p) => byId.has(p.from) && byId.has(p.to)).map((p) => (
            <button
              key={p.label}
              type="button"
              className="chip"
              onClick={() => {
                setFrom(p.from);
                setTo(p.to);
                setMaxHops(p.hops);
                setWithProjects(p.projects);
                run(p);
              }}
            >
              {t(p.label)}
            </button>
          ))}
          {me && byId.has(1) && me.employee_id !== 1 && (
            <button
              type="button"
              className="chip"
              onClick={() => {
                setFrom(me.employee_id);
                setTo(1);
                run({ from: me.employee_id, to: 1 });
              }}
            >
              {t('Tôi tới Tổng Giám đốc')}
            </button>
          )}
        </div>
      </form>

      <section className="path-result" ref={resultRef} tabIndex={-1} aria-live="polite" aria-busy={loading}>
        {loading ? (
          <div className="path-loading">
            <div className="trail-skeleton" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} style={{ '--d': `${i * 160}ms` }} />
              ))}
            </div>
            <LoadingNote slow={slow} lines={PATH_LINES} />
          </div>
        ) : error ? (
          <ErrorState error={error} onRetry={() => run()} />
        ) : result && !result.found ? (
          <EmptyState icon="route" title={t('Không có đường trong {n} bậc', { n: result.max_hops })} description={t('Hai người chưa liên hệ qua kết nối hay quản lý trong giới hạn này. Thử tăng số bậc hoặc bật đi qua dự án chung.')} action={result.max_hops < 6 ? t('Thử với 6 bậc') : undefined} onAction={() => { setMaxHops(6); run({ hops: 6 }); }} />
        ) : result ? (
          <>
            <div className="path-summary">
              <p className="path-hops lk-num">
                {result.path_length}
                <span>{t('bậc')}</span>
              </p>
              <div>
                <h2 className="t-h3">{t('Từ {a} tới {b}', { a: fromName || result.steps[0]?.from_name, b: toName || result.steps[result.steps.length - 1]?.to_name })}</h2>
                <p className="muted">
                  {result.alternative_paths?.length ? t('Còn {n} đường khác cùng độ dài.', { n: result.alternative_paths.length }) : t('Đây là đường ngắn nhất duy nhất trong giới hạn đã chọn.')}
                </p>
              </div>
              <Button variant="ghost" size="sm" iconStart="rotate-right" onClick={() => setPlayKey((k) => k + 1)} className="path-replay">
                {t('Vẽ lại')}
              </Button>
            </div>
            <PathTrail steps={result.steps} playKey={playKey} />
            <details className="path-steps">
              <summary>
                <Icon name="list" size={14} />
                {t('Chi tiết từng bước')}
              </summary>
              <ol>
                {result.steps.map((s) => (
                  <li key={s.step}>
                    <span className="lk-num step-no">{s.step}</span>
                    <span>
                      <strong>{s.from_name}</strong> {s.relation_category === 'ReportsTo' ? t('có quan hệ báo cáo với') : s.relation_category === 'WorksOn' ? t('cùng dự án với') : t('có kết nối ({type}) với', { type: s.relation_detail })} <strong>{s.to_name}</strong>
                      {s.strength != null && <span className="muted">, {t('độ mạnh {v}', { v: String(s.strength).replace('.', ',') })}</span>}
                    </span>
                  </li>
                ))}
              </ol>
            </details>
          </>
        ) : (
          <EmptyState mascot title={t('Chọn hai người để bắt đầu')} description={t('Linko sẽ vẽ từng bậc kết nối, từ người thứ nhất tới người thứ hai.')} />
        )}
      </section>
    </div>
  );
}
