import { cloneElement, useId, useRef, useState } from 'react';

// Tooltip: hiện sau 500ms khi di chuột, hiện ngay khi focus bàn phím. Góc đuôi bong bóng (radius-tail).
export default function Tooltip({ content, placement = 'top', disabled = false, children }) {
  const [open, setOpen] = useState(false);
  const timer = useRef(null);
  const id = useId();
  if (disabled || !content) return children;
  const show = (delay) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), delay);
  };
  const hide = () => {
    clearTimeout(timer.current);
    setOpen(false);
  };
  return (
    <span className="tt-wrap" onMouseEnter={() => show(500)} onMouseLeave={hide} onFocus={() => show(0)} onBlur={hide}
      onKeyDown={(e) => e.key === 'Escape' && hide()}>
      {cloneElement(children, { 'aria-describedby': open ? id : undefined })}
      {open && (
        <span role="tooltip" id={id} className={`tt tt-${placement}`}>
          {content}
        </span>
      )}
    </span>
  );
}
