import React, { useLayoutEffect, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface PopoverProps {
  anchor: HTMLElement;
  children: React.ReactNode;
  gap?: number;
  onClose?: () => void;
}

const Popover: React.FC<PopoverProps> = ({ anchor, children, gap = 6, onClose }) => {
  const [style, setStyle] = useState<React.CSSProperties>({ position: 'absolute', visibility: 'hidden' });

  useLayoutEffect(() => {
    function recalc() {
      const r = anchor.getBoundingClientRect();
      setStyle({
        position: 'absolute',
        top: r.bottom + window.scrollY + gap,
        left: r.left + window.scrollX,
        zIndex: 1000,
      });
    }
    recalc();
    window.addEventListener('scroll', recalc, true);
    window.addEventListener('resize', recalc);
    return () => {
      window.removeEventListener('scroll', recalc, true);
      window.removeEventListener('resize', recalc);
    };
  }, [anchor, gap]);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!anchor || !(e.target instanceof Node)) return;
      const dropdown = document.querySelector('[data-popover="true"]');
      if (dropdown && !dropdown.contains(e.target) && !anchor.contains(e.target)) {
        onClose?.();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [anchor, onClose]);

  return createPortal(
    <div style={style} data-popover="true">
      {children}
    </div>,
    document.body
  );
};

export default Popover; 