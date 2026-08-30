const stroke = {
  fill: 'none',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export function Branch({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...stroke} strokeWidth={2}>
      <circle cx="7" cy="5.5" r="2.5" />
      <circle cx="7" cy="18.5" r="2.5" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M7 8v8" />
      <path d="M17 11.5c0 3-3.5 3.5-6 4.5" />
    </svg>
  );
}

export function BranchMerged({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...stroke} strokeWidth={2}>
      <path d="M7 4v9" />
      <circle cx="7" cy="18.5" r="2.5" />
      <path d="M7 13c0 3 4 3 7 3" />
      <circle cx="16.5" cy="16" r="2.5" />
    </svg>
  );
}

export function Grid({ size = 22, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...stroke}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" />
    </svg>
  );
}

export function TaskCircle({ size = 22, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...stroke}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 12.2l2.4 2.4 4.6-4.9" />
    </svg>
  );
}

export function Search({ size = 22, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...stroke}>
      <circle cx="10.8" cy="10.8" r="6.8" />
      <path d="M15.8 15.8L20.5 20.5" />
    </svg>
  );
}

export function Tune({ size = 22, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...stroke}>
      <path d="M4 7h10" />
      <path d="M18 7h2" />
      <circle cx="16" cy="7" r="2" />
      <path d="M4 17h4" />
      <path d="M12 17h8" />
      <circle cx="10" cy="17" r="2" />
    </svg>
  );
}

export function Clock({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...stroke}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 1.8" />
    </svg>
  );
}

export function Note({ size = 18, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...stroke}>
      <path d="M6 3.5h8l4.5 4.5v12.5H6z" />
      <path d="M14 3.5V8h4.5" />
      <path d="M9 12.5h6" />
      <path d="M9 16h4" />
    </svg>
  );
}

export function Chevron({ size = 18, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...stroke}>
      <path d="M9.5 5.5l6 6.5-6 6.5" />
    </svg>
  );
}

export function Sort({ size = 18, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...stroke}>
      <path d="M7 4v16" />
      <path d="M3.5 16.5L7 20l3.5-3.5" />
      <path d="M14 6h7" />
      <path d="M14 11h5" />
      <path d="M14 16h3" />
    </svg>
  );
}

export function Check({ size = 13, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke={color} fill="none" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  );
}

export function Refresh({ size = 18, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...stroke}>
      <path d="M20 12a8 8 0 1 1-2.6-5.9" />
      <path d="M20 4v5h-5" />
    </svg>
  );
}

export function Tree({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...stroke}>
      <rect x="4" y="3.5" width="16" height="6" rx="2" />
      <rect x="4" y="14.5" width="7" height="6" rx="2" />
      <rect x="13" y="14.5" width="7" height="6" rx="2" />
      <path d="M12 9.5v3" />
    </svg>
  );
}
