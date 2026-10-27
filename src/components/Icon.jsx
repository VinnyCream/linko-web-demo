import { FA_ICONS } from '../lib/fa-icons.js';

// Icon Font Awesome Free 7 trong một hộp vuông cố định: mọi biểu tượng (rộng hay hẹp)
// đều chiếm đúng size x size và được căn giữa, nên cột biểu tượng luôn thẳng hàng.
// filled=false: vẽ Regular nếu có, ngược lại Solid. anim: shake | beat | bounce | pop | spin.
export default function Icon({ name, filled = false, size = 18, label, anim, animKey, className = '', style }) {
  const def = FA_ICONS[name] || FA_ICONS['circle'];
  const [w, h, solid, regW, regular] = def;
  const useRegular = !filled && regular;
  const width = useRegular ? regW || w : w;
  const path = useRegular ? regular : solid;
  const box = Math.max(width, h);
  const offX = (width - box) / 2;
  const offY = (h - box) / 2;
  return (
    <span
      key={animKey}
      className={`ic${anim ? ` anim-${anim}` : ''} ${className}`}
      style={{ '--ic': `${size}px`, ...style }}
      role={label ? 'img' : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
    >
      <svg viewBox={`${offX} ${offY} ${box} ${box}`} width={size} height={size} focusable="false">
        <path fill="currentColor" d={path} />
      </svg>
    </span>
  );
}
