import Icon from './Icon.jsx';
import Avatar from './Avatar.jsx';
import { ConnectionTag } from './Badge.jsx';
import { Link } from '../lib/router.jsx';
import { useT } from '../state/prefs.jsx';
import { usePeople } from '../state/people.jsx';

// Đường kết nối ngắn nhất, vẽ lần lượt từ nguồn tới đích: khoảnh khắc thưởng của Linko.
// steps lấy nguyên từ ShortestPathResponse.steps. Đổi playKey để vẽ lại.
export default function PathTrail({ steps = [], playKey }) {
  const t = useT();
  const { byId } = usePeople();
  if (!steps.length) return null;
  const nodes = [
    { id: steps[0].from_id, name: steps[0].from_name, type: steps[0].from_type || 'Employee' },
    ...steps.map((s) => ({ id: s.to_id, name: s.to_name, type: s.to_type || 'Employee' })),
  ];
  const edgeLabel = (s) => {
    if (s.relation_category === 'ReportsTo') {
      const [a] = String(s.direction).split('->');
      const upward = Number(a) === Number(s.from_id);
      return (
        <span className="trail-rel">
          <Icon name={upward ? 'arrow-up' : 'arrow-down'} size={11} />
          {upward ? t('Báo cáo cho') : t('Quản lý của')}
        </span>
      );
    }
    if (s.relation_category === 'WorksOn') {
      return (
        <span className="trail-rel">
          <Icon name="folder" size={11} />
          {String(s.relation_detail).replace('Tham gia dự án: ', '') || t('Cùng dự án')}
        </span>
      );
    }
    return <ConnectionTag type={s.relation_detail} />;
  };
  return (
    <div className="trail-wrap">
      <ol className="trail" key={playKey} aria-label={t('Đường kết nối gồm {n} bậc', { n: steps.length })}>
        {nodes.map((n, i) => {
          const person = n.type === 'Employee' ? byId.get(Number(n.id)) : null;
          const end = i === 0 || i === nodes.length - 1;
          return (
            <li key={`${n.type}-${n.id}-${i}`} className="trail-item" style={{ '--i': i }}>
              <div className={`trail-node${end ? ' is-end' : ''}`}>
                {n.type === 'Project' ? (
                  <span className="trail-project" aria-hidden="true">
                    <Icon name="folder" size={18} />
                  </span>
                ) : (
                  <Avatar id={n.id} name={n.name} size={end ? 'lg' : 'md'} presence={false} />
                )}
                <span className="trail-text">
                  {n.type === 'Project' ? (
                    <Link to={`/projects/${n.id}`} className="trail-name">{n.name}</Link>
                  ) : (
                    <Link to={`/people/${n.id}`} className="trail-name">{n.name}</Link>
                  )}
                  <span className="trail-sub">{n.type === 'Project' ? t('Dự án') : person?.title || ''}</span>
                </span>
              </div>
              {i < steps.length && (
                <div className="trail-edge" style={{ '--i': i }}>
                  <span className="trail-line" aria-hidden="true" />
                  <span className="trail-label">{edgeLabel(steps[i])}</span>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
