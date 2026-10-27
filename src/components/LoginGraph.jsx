import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { initials } from '../lib/format.js';
import { useT } from '../state/prefs.jsx';

// Đồ thị sống cho trang đăng nhập. Mọi người và cạnh đều lấy từ 02_sample_data.sql
// (reports_to và knows có thật), chỉ toạ độ là sắp đặt tay cho đẹp.
// Tự chạy: một tín hiệu đi dọc đường ngắn nhất tới Tổng Giám đốc. Bấm (hoặc Enter) vào một người
// để vẽ đường của người đó. Di chuột tạo hiệu ứng chiều sâu. Tôn trọng prefers-reduced-motion.
const PEOPLE = [
  [1, 'Nguyễn Văn An', 'Tổng Giám đốc', 610, 64],
  [2, 'Trần Thị Bình', 'Phó Tổng Giám đốc', 470, 48],
  [3, 'Lê Minh Cường', 'Giám đốc Công nghệ', 520, 168],
  [4, 'Phạm Thu Dung', 'Giám đốc Sản phẩm', 668, 182],
  [5, 'Hoàng Văn Em', 'Giám đốc Marketing', 700, 74],
  [6, 'Võ Thị Phương', 'Trưởng phòng Backend', 420, 252],
  [7, 'Đặng Quốc Huy', 'Trưởng phòng Frontend', 608, 290],
  [8, 'Bùi Minh Tuấn', 'Tech Lead', 322, 318],
  [9, 'Ngô Thị Lan', 'Senior Backend Dev', 228, 372],
  [10, 'Đỗ Văn Khoa', 'Senior Frontend Dev', 548, 384],
  [11, 'Lý Thị Mai', 'Backend Developer', 142, 418],
  [12, 'Trương Văn Nam', 'Frontend Developer', 452, 460],
  [15, 'Đinh Thị Quỳnh', 'Data Engineer', 92, 196],
  [20, 'Ngô Văn Vinh', 'Junior Backend', 56, 486],
  [23, 'Nguyễn Thị Ánh', 'Product Manager', 664, 392],
  [24, 'Phạm Văn Bảo', 'Product Owner', 690, 486],
  [33, 'Đỗ Thị Nga', 'HR Manager', 352, 86],
  [53, 'Võ Văn Nam', 'Tech Lead HN', 52, 330],
  [58, 'Vũ Văn Tâm', 'Developer DN', 300, 492],
  [63, 'Hồ Thị Ánh', 'R&D Manager', 296, 180],
  [64, 'Ngô Văn Bảo', 'AI Researcher', 184, 112],
];
// [a, b, loại]: MENTOR, FRIEND, COLLEAGUE là quan hệ Knows; REPORTS là reports_to (a báo cáo cho b).
const EDGES = [
  [2, 1, 'REPORTS'], [3, 1, 'REPORTS'], [4, 1, 'REPORTS'], [5, 1, 'REPORTS'], [6, 3, 'REPORTS'], [7, 3, 'REPORTS'],
  [8, 6, 'REPORTS'], [9, 8, 'MENTOR'], [10, 7, 'MENTOR'], [11, 9, 'MENTOR'], [12, 10, 'MENTOR'], [20, 11, 'MENTOR'],
  [23, 4, 'REPORTS'], [24, 23, 'REPORTS'], [33, 2, 'REPORTS'], [63, 3, 'REPORTS'], [64, 63, 'REPORTS'], [15, 8, 'REPORTS'],
  [8, 23, 'FRIEND'], [9, 24, 'COLLEAGUE'], [15, 64, 'COLLEAGUE'], [6, 63, 'FRIEND'], [53, 11, 'FRIEND'], [58, 12, 'COLLEAGUE'],
];
const REL = { REPORTS: 'Quan hệ báo cáo', MENTOR: 'Người hướng dẫn', FRIEND: 'Bạn bè', COLLEAGUE: 'Đồng nghiệp' };
const TONES = ['colleague', 'teammate', 'mentor', 'mentee', 'friend', 'follow'];
const TARGET = 1;
const TOUR = [20, 53, 58, 15, 24, 12];

function shortest(from, to) {
  const adj = new Map();
  EDGES.forEach(([a, b, kind], i) => {
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a).push([b, i]);
    adj.get(b).push([a, i]);
  });
  const prev = new Map([[from, null]]);
  const queue = [from];
  while (queue.length) {
    const u = queue.shift();
    if (u === to) break;
    (adj.get(u) || []).forEach(([v, i]) => {
      if (!prev.has(v)) {
        prev.set(v, [u, i]);
        queue.push(v);
      }
    });
  }
  const nodes = [to];
  const edges = [];
  let cur = to;
  while (prev.get(cur)) {
    const [u, i] = prev.get(cur);
    edges.unshift(i);
    nodes.unshift(u);
    cur = u;
  }
  return { nodes, edges };
}

export default function LoginGraph() {
  const t = useT();
  const reduce = useMemo(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches, []);
  const byId = useMemo(() => new Map(PEOPLE.map((p) => [p[0], p])), []);
  const [start, setStart] = useState(TOUR[0]);
  const [step, setStep] = useState(0);
  const [hover, setHover] = useState(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const manualUntil = useRef(0);
  const tourIndex = useRef(0);
  const path = useMemo(() => shortest(start, TARGET), [start]);

  // Tín hiệu đi từng bậc; xong đường thì chờ rồi chuyển sang người kế tiếp (nếu người dùng không bấm).
  useEffect(() => {
    if (reduce) {
      setStep(path.edges.length);
      return undefined;
    }
    setStep(0);
    let s = 0;
    const id = setInterval(() => {
      s += 1;
      if (s <= path.edges.length) setStep(s);
      if (s > path.edges.length + 4) {
        clearInterval(id);
        if (Date.now() > manualUntil.current) {
          tourIndex.current = (tourIndex.current + 1) % TOUR.length;
          setStart(TOUR[tourIndex.current]);
        } else {
          setStep(path.edges.length);
        }
      }
    }, 640);
    return () => clearInterval(id);
  }, [path, reduce]);

  const pick = useCallback((id) => {
    if (id === TARGET) return;
    manualUntil.current = Date.now() + 15000;
    setStart((cur) => {
      if (cur === id) setStep(0);
      return id;
    });
  }, []);

  const onMove = (e) => {
    if (reduce) return;
    const box = e.currentTarget.getBoundingClientRect();
    setTilt({ x: (e.clientX - box.left) / box.width - 0.5, y: (e.clientY - box.top) / box.height - 0.5 });
  };

  const onPath = new Set(path.nodes.slice(0, step + 1));
  const litEdges = new Set(path.edges.slice(0, step));
  const head = path.nodes[Math.min(step, path.nodes.length - 1)];
  const headPos = byId.get(head);
  const hoverSet = useMemo(() => {
    if (!hover) return null;
    const s = new Set([hover]);
    EDGES.forEach(([a, b]) => {
      if (a === hover) s.add(b);
      if (b === hover) s.add(a);
    });
    return s;
  }, [hover]);
  const current = step > 0 && step <= path.edges.length ? EDGES[path.edges[step - 1]] : null;
  const curA = current ? byId.get(current[0]) : null;
  const curB = current ? byId.get(current[1]) : null;

  return (
    <div className="lg" onPointerMove={onMove} onPointerLeave={() => setTilt({ x: 0, y: 0 })}>
      <svg
        viewBox="14 26 744 530"
        className="lg-svg"
        role="group"
        aria-label={t('Đồ thị mẫu: bấm vào một người để vẽ đường tới Tổng Giám đốc')}
        style={{ '--tx': tilt.x, '--ty': tilt.y }}
      >
        <defs>
          <radialGradient id="lg-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--brand-blue)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--brand-blue)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <g className="lg-layer lg-edges">
          {EDGES.map(([a, b, kind], i) => {
            const A = byId.get(a);
            const B = byId.get(b);
            const lit = litEdges.has(i);
            const dim = hoverSet && !(hoverSet.has(a) && hoverSet.has(b));
            return (
              <g key={i} className={`lg-edge k-${kind.toLowerCase()}${lit ? ' is-lit' : ''}${dim ? ' is-dim' : ''}`}>
                <line x1={A[3]} y1={A[4]} x2={B[3]} y2={B[4]} className="lg-edge-base" />
                <line x1={A[3]} y1={A[4]} x2={B[3]} y2={B[4]} className="lg-edge-lit" pathLength="1" />
                {lit && <line x1={A[3]} y1={A[4]} x2={B[3]} y2={B[4]} className="lg-edge-flow" />}
              </g>
            );
          })}
        </g>
        {headPos && !reduce && <circle className="lg-glow" cx={headPos[3]} cy={headPos[4]} r="70" fill="url(#lg-glow)" />}
        <g className="lg-layer lg-nodes">
          {PEOPLE.map(([id, name, title, x, y], i) => {
            const isTarget = id === TARGET;
            const isStart = id === start;
            const lit = onPath.has(id);
            const dim = hoverSet && !hoverSet.has(id) && !lit;
            const showLabel = isTarget || isStart || hover === id || head === id;
            const r = isTarget ? 24 : isStart ? 22 : 17;
            return (
              <g
                key={id}
                className={`lg-node tone-${TONES[i % TONES.length]}${lit ? ' is-lit' : ''}${isTarget ? ' is-target' : ''}${isStart ? ' is-start' : ''}${dim ? ' is-dim' : ''}`}
                transform={`translate(${x} ${y})`}
                tabIndex={isTarget ? -1 : 0}
                role={isTarget ? undefined : 'button'}
                aria-label={isTarget ? undefined : t('Vẽ đường từ {name} tới Tổng Giám đốc', { name })}
                onClick={() => pick(id)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), pick(id))}
                onPointerEnter={() => setHover(id)}
                onPointerLeave={() => setHover(null)}
              >
                <g className="lg-float" style={{ animationDelay: `${(i % 7) * -0.8}s` }}>
                  {(isTarget || head === id) && <circle r={r + 9} className="lg-halo" />}
                  <circle r={r} className="lg-dot" />
                  <text className="lg-initials" dy="0.35em">{initials(name)}</text>
                  {showLabel && (
                    <g className="lg-label" transform={`translate(0 ${r + 16})`}>
                      <text className="lg-name">{name}</text>
                      <text className="lg-title" dy="15">{t(title)}</text>
                    </g>
                  )}
                </g>
              </g>
            );
          })}
        </g>
        {headPos && !reduce && step > 0 && step <= path.edges.length && (
          <circle className="lg-signal" r="6" style={{ transform: `translate(${headPos[3]}px, ${headPos[4]}px)` }} />
        )}
      </svg>
      <div className="login-story" aria-live="polite">
        <span className="login-story-hops lk-num" aria-hidden="true">{path.edges.length}</span>
        <span className="login-story-text">
          <span className="login-story-line">
            <strong>{byId.get(start)[1]}</strong> {t('tới')} <strong>{byId.get(TARGET)[1]}</strong>
            <span className="muted"> {t('qua {n} bậc kết nối', { n: path.edges.length })}</span>
          </span>
          <span className="login-story-step">
            {current ? (
              <>
                <span className="lk-num">{t('Bước {i}/{n}', { i: step, n: path.edges.length })}</span>
                <span>{curA[1]} {t('và')} {curB[1]}</span>
                <span className="login-story-rel">{t(REL[current[2]])}</span>
              </>
            ) : (
              <span>{t('Bấm vào bất kỳ ai trên đồ thị để vẽ đường của họ.')}</span>
            )}
          </span>
        </span>
      </div>
    </div>
  );
}

export const LOGIN_REL = REL;
