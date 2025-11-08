import React from 'react';

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger';
};

export default function Button({ variant = 'primary', children, ...props }: Props) {
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: 'var(--primary)', color: 'black' },
    secondary: { background: '#334155', color: 'white' },
    danger: { background: 'var(--danger)', color: 'white' }
  };
  return (
    <button
      {...props}
      style={{
        padding: '10px 14px',
        borderRadius: 10,
        border: 'none',
        cursor: 'pointer',
        ...styles[variant]
      }}
    >
      {children}
    </button>
  );
}
``