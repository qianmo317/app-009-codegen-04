import type { ReactNode } from 'react';
import { toneColors, type BadgeTone } from './styles';

export function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  const c = toneColors[tone];
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 10,
        fontSize: 12,
        background: c.bg,
        color: c.fg,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

export function TopBar() {
  return (
    <div
      style={{
        borderBottom: '1px solid #e0dcd5',
        background: '#fffdf8',
        padding: '10px 24px',
        display: 'flex',
        gap: 16,
        alignItems: 'center',
        fontSize: 14,
      }}
    >
      <a href="#/" style={{ color: '#555', textDecoration: 'none' }}>
        🧶 图解工作室
      </a>
      <a href="#/classes" style={{ color: '#2471a3', textDecoration: 'none', fontWeight: 600 }}>
        📒 报名本子
      </a>
    </div>
  );
}
