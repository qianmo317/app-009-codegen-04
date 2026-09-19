import type { CSSProperties } from 'react';

export const pageStyle: CSSProperties = {
  padding: 24,
  maxWidth: 1000,
  margin: '0 auto',
};

export const cardStyle: CSSProperties = {
  border: '1px solid #e0dcd5',
  borderRadius: 8,
  padding: 16,
  background: '#fff',
};

export const btnPrimary: CSSProperties = {
  padding: '8px 16px',
  borderRadius: 4,
  border: '1px solid #3498db',
  background: '#3498db',
  color: '#fff',
  cursor: 'pointer',
  fontSize: 14,
};

export const btnGhost: CSSProperties = {
  padding: '6px 12px',
  borderRadius: 4,
  border: '1px solid #bdc3c7',
  background: '#fff',
  color: '#555',
  cursor: 'pointer',
  fontSize: 13,
};

export const btnDanger: CSSProperties = {
  padding: '6px 12px',
  borderRadius: 4,
  border: '1px solid #e74c3c',
  background: '#fff',
  color: '#e74c3c',
  cursor: 'pointer',
  fontSize: 13,
};

export const inputStyle: CSSProperties = {
  padding: '6px 8px',
  border: '1px solid #cfcac2',
  borderRadius: 4,
  fontSize: 14,
  width: '100%',
};

export const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 13,
  color: '#666',
  marginBottom: 4,
};

export type BadgeTone = 'green' | 'orange' | 'gray' | 'red' | 'blue';

export const toneColors: Record<BadgeTone, { bg: string; fg: string }> = {
  green: { bg: '#e6f4ea', fg: '#1e7e34' },
  orange: { bg: '#fdf0e0', fg: '#b5651d' },
  gray: { bg: '#eeeae4', fg: '#888' },
  red: { bg: '#fdecea', fg: '#c0392b' },
  blue: { bg: '#e8f1fb', fg: '#2471a3' },
};
