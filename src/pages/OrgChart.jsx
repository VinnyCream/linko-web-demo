import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import Avatar from '../components/Avatar.jsx';
import Icon from '../components/Icon.jsx';
import { Button } from '../components/Button.jsx';
import { PersonPicker } from '../components/Form.jsx';
import { Badge } from '../components/Badge.jsx';
import { EmptyState, ErrorState, LoadingNote, SkeletonList } from '../components/Feedback.jsx';
import { Link, useLocation, useNavigate } from '../lib/router.jsx';
import { useT } from '../state/prefs.jsx';
import { useQuery } from '../hooks/useQuery.js';
import { api } from '../api/endpoints.js';

// Sơ đồ tổ chức dạng cây (tối đa 5 cấp) dựng từ cạnh ReportsTo của GET /api/graph/subordinates/{id}.
// Hiện kèm kết quả so sánh GRAPH_TABLE với CONNECT BY mà backend trả về.
function TreeNode({ node, childrenOf, depth, expanded, toggle }) {
  const t = useT();
  const kids = childrenOf.get(node.id) || [];
  const open = expanded.has(node.id);
  return (
    <li role="treeitem" aria-expanded={kids.length ? open : undefined} aria-level={depth + 1} className="tree-item">
      <div className="tree-row" style={{ '--depth': depth }}>
        {kids.length ? (
          <button type="button" className="tree-toggle" onClick={() => toggle(node.id)} aria-label={open ? t('Thu gọn nhóm của {name}', { name: node.label }) : t('Mở nhóm của {name}', { name: node.label })}>
            <Icon name={open ? 'chevron-down' : 'chevron-right'} size={11} />
          </button>
        ) : (
          <span className="tree-toggle is-leaf" aria-hidden="true" />
        )}
        <Avatar id={node.raw_id} name={node.label} size="sm" presence={false} />
        <span className="row-text">
          <Link to={`/people/${node.raw_id}`} className="t-label truncate">{node.label}</Link>
          <span className="muted t-caption truncate">{node.title}</span>
        </span>
        {kids.length > 0 && <span className="tree-count lk-num" title={t('{n} cấp dưới trực tiếp', { n: kids.length })}>{kids.length}</span>}
      </div>
      {kids.length > 0 && open && (
        <ul role="group" className="tree-group">
          {kids.map((k) => (
            <TreeNode key={k.id} node={k} childrenOf={childrenOf} depth={depth + 1} expanded={expanded} toggle={toggle} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function OrgChart() {
  const t = useT();
  const location = useLocation();
  const navigate = useNavigate();
  const [root, setRoot] = useState(Number(location.query.get('root')) || 1);
  const q = useQuery(`graph:sub:${root}`, () => api.subordinates(root));
  const chain = useQuery(`profile:${root}:managers`, () => api.employeeManagers(root));
  const [expanded, setExpanded] = useState(new Set());

  const tree = useMemo(() => {
    const nodes = (q.data?.elements?.nodes || []).map((n) => n.data);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const childrenOf = new Map();
    (q.data?.elements?.edges || []).forEach(({ data: e }) => {
      if (!byId.has(e.source) || !byId.has(e.target)) return;
      if (!childrenOf.has(e.target)) childrenOf.set(e.target, []);
      childrenOf.get(e.target).push(byId.get(e.source));
    });
    childrenOf.forEach((list) => list.sort((a, b) => String(a.label).localeCompare(String(b.label), 'vi')));
    return { rootNode: byId.get(`emp_${root}`), childrenOf, count: nodes.length - 1 };
  }, [q.data, root]);

  useEffect(() => {
    if (!tree.rootNode) return;
    const first = new Set([tree.rootNode.id]);
    (tree.childrenOf.get(tree.rootNode.id) || []).forEach((c) => first.add(c.id));
    setExpanded(first);
  }, [tree.rootNode, tree.childrenOf]);

  const toggle = (id) => setExpanded((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const expandAll = () => setExpanded(new Set([tree.rootNode?.id, ...tree.childrenOf.keys()]));
  const cmp = q.data?.comparison;

  return (
    <div className="page">
      <PageHeader
        title={t('Sơ đồ tổ chức')}
        crumbs={[{ label: t('Tổ chức') }, { label: t('Sơ đồ tổ chức') }]}
        description={t('Ai báo cáo cho ai, tối đa 5 cấp tính từ người được chọn.')}
      />
      <div className="toolbar">
        <div className="toolbar-picker">
          <PersonPicker
            value={root}
            onChange={(v) => {
              if (!v) return;
              setRoot(v);
              navigate(`/org?root=${v}`, { replace: true });
            }}
            placeholder={t('Chọn người đứng đầu nhánh')}
          />
        </div>
        <Button variant="ghost" iconStart="list" onClick={expandAll} disabled={!tree.count}>
          {t('Mở toàn bộ')}
        </Button>
        <Button variant="ghost" onClick={() => setExpanded(new Set([tree.rootNode?.id]))} disabled={!tree.count}>
          {t('Thu gọn')}
        </Button>
      </div>

      {chain.data?.length > 0 && (
        <nav className="chain-line" aria-label={t('Cấp trên của nhánh này')}>
          <span className="muted t-caption">{t('Cấp trên:')}</span>
          {[...chain.data].reverse().map((m) => (
            <button key={m.employee_id} type="button" className="chip" onClick={() => { setRoot(m.employee_id); navigate(`/org?root=${m.employee_id}`, { replace: true }); }}>
              {m.full_name}
            </button>
          ))}
        </nav>
      )}

      <section className="panel" aria-busy={q.loading}>
        {q.loading ? (
          <>
            <LoadingNote slow={q.slow} lines={['Đang duyệt quan hệ báo cáo bằng GRAPH_TABLE...', 'Đối chiếu với CONNECT BY để chắc chắn kết quả khớp.', 'Sắp xong rồi.']} />
            <SkeletonList count={7} />
          </>
        ) : q.error ? (
          <ErrorState error={q.error} onRetry={q.refetch} />
        ) : !tree.rootNode ? (
          <EmptyState icon="sitemap" title={t('Không dựng được sơ đồ')} />
        ) : (
          <>
            <div className="panel-head">
              <p className="t-ui">{tree.count ? t('{n} người trong nhánh này', { n: tree.count }) : t('Người này chưa có cấp dưới.')}</p>
              {cmp && (
                <Badge tone={cmp.matching ? 'success' : 'warning'} icon={cmp.matching ? 'circle-check' : 'triangle-exclamation'}>
                  {cmp.matching ? t('GRAPH_TABLE khớp CONNECT BY') : t('GRAPH_TABLE lệch CONNECT BY ({a} so với {b})', { a: cmp.graph_count, b: cmp.connect_by_within_five_count })}
                </Badge>
              )}
            </div>
            <ul role="tree" aria-label={t('Sơ đồ tổ chức')} className="tree">
              <TreeNode node={tree.rootNode} childrenOf={tree.childrenOf} depth={0} expanded={expanded} toggle={toggle} />
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
