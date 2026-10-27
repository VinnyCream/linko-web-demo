import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { useT } from '../state/prefs.jsx';
import { initials, hashIndex } from '../lib/format.js';

// Đồ thị mạng lưới vẽ bằng SVG, bố cục lực (force-directed) tính sẵn, không cần thư viện ngoài.
// elements: Cytoscape elements từ API ({ nodes: [{data}], edges: [{data}] }).
// Ctrl + cuộn hoặc chụm hai ngón để phóng to; kéo để di chuyển; bấm một người để xem chi tiết.
const TONES = ['colleague', 'teammate', 'mentor', 'mentee', 'friend', 'follow'];

function layout(nodes, edges, centerId) {
  const n = nodes.length;
  const index = new Map(nodes.map((d, i) => [d.id, i]));
  const pos = nodes.map((d, i) => {
    const angle = (i / Math.max(1, n)) * Math.PI * 2 + hashIndex(d.id, 100) / 50;
    const r = 60 + (hashIndex(d.id, 97) % 160);
    return { x: Math.cos(angle) * r, y: Math.sin(angle) * r, vx: 0, vy: 0 };
  });
  const links = edges.map((e) => [index.get(e.source), index.get(e.target)]).filter(([a, b]) => a !== undefined && b !== undefined && a !== b);
  const degree = new Array(n).fill(0);
  links.forEach(([a, b]) => {
    degree[a] += 1;
    degree[b] += 1;
  });
  const center = index.get(centerId);
  const area = 900 * 900;
  const k = Math.sqrt(area / Math.max(1, n)) * 0.55;
  const iterations = n > 150 ? 220 : 320;
  let temp = 80;
  for (let it = 0; it < iterations; it += 1) {
    for (let i = 0; i < n; i += 1) {
      pos[i].vx = 0;
      pos[i].vy = 0;
    }
    for (let i = 0; i < n; i += 1) {
      for (let j = i + 1; j < n; j += 1) {
        let dx = pos[i].x - pos[j].x;
        let dy = pos[i].y - pos[j].y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 0.01) {
          dx = (i - j) * 0.1;
          dy = 0.1;
          d2 = dx * dx + dy * dy;
        }
        const d = Math.sqrt(d2);
        const f = (k * k) / d;
        pos[i].vx += (dx / d) * f;
        pos[i].vy += (dy / d) * f;
        pos[j].vx -= (dx / d) * f;
        pos[j].vy -= (dy / d) * f;
      }
    }
    links.forEach(([a, b]) => {
      const dx = pos[a].x - pos[b].x;
      const dy = pos[a].y - pos[b].y;
      const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const f = (d * d) / k / (1 + Math.min(degree[a], degree[b]) * 0.15);
      pos[a].vx -= (dx / d) * f;
      pos[a].vy -= (dy / d) * f;
      pos[b].vx += (dx / d) * f;
      pos[b].vy += (dy / d) * f;
    });
    for (let i = 0; i < n; i += 1) {
      pos[i].vx -= pos[i].x * 0.02 * k * 0.05;
      pos[i].vy -= pos[i].y * 0.02 * k * 0.05;
      const v = Math.sqrt(pos[i].vx ** 2 + pos[i].vy ** 2) || 1;
      const step = Math.min(v, temp);
      if (i !== center) {
        pos[i].x += (pos[i].vx / v) * step;
        pos[i].y += (pos[i].vy / v) * step;
      }
    }
    if (center !== undefined) {
      pos[center].x = 0;
      pos[center].y = 0;
    }
    temp = Math.max(1.5, temp * 0.985);
  }
  return { pos, degree };
}

function edgeTone(edge) {
  const label = String(edge.label || edge.detail || '').toUpperCase();
  if (edge.category === 'ReportsTo' || edge.relation_type === 'ReportsTo' || label === 'REPORTS_TO') return 'reports';
  if (edge.category === 'WorksOn') return 'works';
  const map = { COLLEAGUE: 'colleague', TEAMMATE: 'teammate', MENTOR: 'mentor', MENTEE: 'mentee', FRIEND: 'friend', FOLLOW: 'follow' };
  return map[label] || 'colleague';
}

export default function NetworkGraph({ elements, centerId, selectedId, onSelect, height = 520, colorBy = 'department', highlight, label, hiddenTypes }) {
  const t = useT();
  const svgRef = useRef(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [hover, setHover] = useState(null);
  const pointers = useRef(new Map());
  const drag = useRef(null);
  const moved = useRef(false);

  const data = useMemo(() => {
    const nodes = (elements?.nodes || []).map((x) => x.data);
    const ids = new Set(nodes.map((x) => x.id));
    const edges = (elements?.edges || []).map((x) => x.data).filter((e) => ids.has(e.source) && ids.has(e.target));
    const { pos, degree } = layout(nodes, edges, centerId);
    const index = new Map(nodes.map((d, i) => [d.id, i]));
    return { nodes, edges, pos, degree, index };
  }, [elements, centerId]);

  const neighbors = useMemo(() => {
    const focus = hover || selectedId;
    if (!focus) return null;
    const set = new Set([focus]);
    data.edges.forEach((e) => {
      if (e.source === focus) set.add(e.target);
      if (e.target === focus) set.add(e.source);
    });
    return set;
  }, [hover, selectedId, data.edges]);

  const fit = useCallback(() => {
    if (!data.pos.length) return;
    const xs = data.pos.map((p) => p.x);
    const ys = data.pos.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const box = svgRef.current?.getBoundingClientRect();
    const w = box?.width || 800;
    const h = box?.height || height;
    const k = Math.min(2.2, Math.max(0.2, Math.min((w - 80) / (maxX - minX || 1), (h - 80) / (maxY - minY || 1))));
    setView({ k, x: w / 2 - ((minX + maxX) / 2) * k, y: h / 2 - ((minY + maxY) / 2) * k });
  }, [data.pos, height]);

  useEffect(() => {
    fit();
  }, [fit]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return undefined;
    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const box = svg.getBoundingClientRect();
      const mx = e.clientX - box.left;
      const my = e.clientY - box.top;
      setView((v) => {
        const k = Math.min(4, Math.max(0.15, v.k * (e.deltaY < 0 ? 1.12 : 0.89)));
        return { k, x: mx - ((mx - v.x) / v.k) * k, y: my - ((my - v.y) / v.k) * k };
      });
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  const zoom = (factor) => {
    const box = svgRef.current?.getBoundingClientRect();
    const mx = (box?.width || 800) / 2;
    const my = (box?.height || height) / 2;
    setView((v) => {
      const k = Math.min(4, Math.max(0.15, v.k * factor));
      return { k, x: mx - ((mx - v.x) / v.k) * k, y: my - ((my - v.y) / v.k) * k };
    });
  };

  const onPointerDown = (e) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    svgRef.current.setPointerCapture?.(e.pointerId);
    moved.current = false;
    if (pointers.current.size === 1) drag.current = { x: e.clientX, y: e.clientY, view };
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      drag.current = { pinch: Math.hypot(a.x - b.x, a.y - b.y), view, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
    }
  };
  const onPointerMove = (e) => {
    if (!pointers.current.has(e.pointerId) || !drag.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const start = drag.current;
    if (pointers.current.size === 2 && start.pinch) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const box = svgRef.current.getBoundingClientRect();
      const mx = start.mid.x - box.left;
      const my = start.mid.y - box.top;
      const k = Math.min(4, Math.max(0.15, start.view.k * (dist / start.pinch)));
      setView({ k, x: mx - ((mx - start.view.x) / start.view.k) * k, y: my - ((my - start.view.y) / start.view.k) * k });
      moved.current = true;
    } else if (pointers.current.size === 1 && !start.pinch) {
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved.current = true;
      setView({ ...start.view, x: start.view.x + dx, y: start.view.y + dy });
    }
  };
  const onPointerUp = (e) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) drag.current = null;
  };

  const showLabels = data.nodes.length <= 40 || view.k > 1.5;
  const deptTone = (d) => TONES[(Number(d?.department_id) || hashIndex(d?.id, 6)) % TONES.length];
  const hopTone = (d) => ['primary', 'teammate', 'mentor', 'follow'][Math.min(3, Number(d?.hops ?? (d.id === centerId ? 0 : 1)))];
  const highlightNodes = highlight?.nodes;
  const highlightEdges = highlight?.edges;

  return (
    <div className="graph" style={{ '--graph-h': `${height}px` }}>
      <svg
        ref={svgRef}
        className="graph-svg"
        role="img"
        aria-label={label || t('Đồ thị gồm {n} người và {m} kết nối', { n: data.nodes.length, m: data.edges.length })}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          <g className="graph-edges">
            {data.edges.map((e, i) => {
              const a = data.pos[data.index.get(e.source)];
              const b = data.pos[data.index.get(e.target)];
              const tone = edgeTone(e);
              if (hiddenTypes?.has(tone)) return null;
              const dim = neighbors && !(neighbors.has(e.source) && neighbors.has(e.target));
              const hot = highlightEdges?.has(`${e.source}|${e.target}`) || highlightEdges?.has(`${e.target}|${e.source}`);
              return (
                <line
                  key={e.id || i}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  className={`gedge gedge-${tone}${dim ? ' is-dim' : ''}${hot ? ' is-hot' : ''}`}
                  style={{ strokeWidth: `${(hot ? 3 : 1.2) / Math.sqrt(view.k)}px` }}
                />
              );
            })}
          </g>
          <g className="graph-nodes">
            {data.nodes.map((d, i) => {
              const p = data.pos[i];
              const isCenter = d.id === centerId;
              const isSel = d.id === selectedId;
              const r = isCenter ? 16 : d.type === 'Project' ? 10 : Math.min(13, 6 + Math.sqrt(data.degree[i]) * 1.2);
              const dim = neighbors && !neighbors.has(d.id);
              const hot = highlightNodes?.has(d.id);
              const tone = d.type === 'Project' ? 'project' : colorBy === 'hops' ? hopTone(d) : deptTone(d);
              return (
                <g
                  key={d.id}
                  className={`gnode tone-${tone}${isCenter ? ' is-center' : ''}${isSel ? ' is-selected' : ''}${dim ? ' is-dim' : ''}${hot ? ' is-hot' : ''}`}
                  transform={`translate(${p.x} ${p.y})`}
                  onPointerEnter={() => setHover(d.id)}
                  onPointerLeave={() => setHover(null)}
                  onClick={() => {
                    if (!moved.current) onSelect?.(d.id, d);
                  }}
                >
                  {d.type === 'Project' ? <rect x={-r} y={-r} width={r * 2} height={r * 2} rx="4" /> : <circle r={r} />}
                  {isCenter && <text className="gnode-initials" dy="0.35em">{initials(d.label)}</text>}
                  {(showLabels || isCenter || isSel || hover === d.id || hot) && (
                    <text className="gnode-label" y={r + 12 / Math.sqrt(view.k)} style={{ fontSize: `${12 / Math.sqrt(view.k)}px` }}>
                      {d.label}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </g>
      </svg>
      <div className="graph-tools">
        <button type="button" className="ibtn ibtn-soft ibtn-sm" onClick={() => zoom(1.25)} aria-label={t('Phóng to')} title={t('Phóng to')}>
          <Icon name="plus" size={14} />
        </button>
        <button type="button" className="ibtn ibtn-soft ibtn-sm" onClick={() => zoom(0.8)} aria-label={t('Thu nhỏ')} title={t('Thu nhỏ')}>
          <Icon name="minus" size={14} />
        </button>
        <button type="button" className="ibtn ibtn-soft ibtn-sm" onClick={fit} aria-label={t('Vừa khung')} title={t('Vừa khung')}>
          <Icon name="object-group" size={14} />
        </button>
      </div>
      <p className="graph-hint">{t('Kéo để di chuyển. Ctrl + cuộn hoặc chụm hai ngón để phóng to.')}</p>
    </div>
  );
}

export const EDGE_LEGEND = [
  ['colleague', 'Đồng nghiệp'],
  ['teammate', 'Đồng đội'],
  ['mentor', 'Người hướng dẫn'],
  ['mentee', 'Được hướng dẫn'],
  ['friend', 'Bạn bè'],
  ['follow', 'Theo dõi'],
  ['reports', 'Báo cáo'],
];
