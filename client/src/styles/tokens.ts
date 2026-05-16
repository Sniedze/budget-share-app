export const colors = {
  background: '#f3f4f6',
  surface: '#ffffff',
  border: '#e5e7eb',
  textPrimary: '#111827',
  textMuted: '#6b7280',
  textSubtle: '#9ca3af',

  /** cyan-600 — main buttons, active nav, selected states */
  primary: '#0891b2',
  /** cyan-700 — hover */
  primaryHover: '#0e7490',
  /** cyan-100 / cyan-700 — active tabs, highlights */
  primaryLightBg: '#cffafe',
  primaryLightText: '#0e7490',
  /** cyan-50 / cyan-600 — profile icon, subtle accents */
  primaryLighterBg: '#ecfeff',
  primaryLighterText: '#0891b2',

  gradientStart: '#06b6d4',
  gradientEnd: '#0891b2',

  accent: '#0891b2',
  accentHover: '#0e7490',

  secondary: '#6b7280',
  secondaryHover: '#4b5563',
  danger: '#ef4444',
  dangerHover: '#dc2626',
  success: '#16a34a',

  sidebarBg: '#ffffff',
  sidebarActiveBg: '#cffafe',
  sidebarActiveText: '#0e7490',

  authCardBorder: '#a5f3fc',
  calloutBg: '#ecfeff',
  calloutBorder: '#a5f3fc',
  calloutText: '#155e75',

  chartStroke: '#0891b2',
  chartFill: '#cffafe',
  chartStrokeLight: '#22d3ee',
  chartFillLight: '#a5f3fc',

  primaryShadow: 'rgba(8, 145, 178, 0.2)',
  primaryShadowStrong: 'rgba(8, 145, 178, 0.28)',
  accentShadow: 'rgba(8, 145, 178, 0.25)',
} as const;

export const gradients = {
  primary: `linear-gradient(135deg, ${colors.gradientStart} 0%, ${colors.gradientEnd} 100%)`,
  primaryHover: `linear-gradient(135deg, ${colors.gradientEnd} 0%, ${colors.primaryHover} 100%)`,
  brand: `linear-gradient(135deg, ${colors.gradientStart}, ${colors.gradientEnd})`,
  authPage: `linear-gradient(180deg, ${colors.primaryLighterBg} 0%, ${colors.primaryLightBg} 100%)`,
  authEyebrow: `linear-gradient(145deg, ${colors.gradientStart}, ${colors.gradientEnd})`,
  authEyebrowHover: `linear-gradient(145deg, ${colors.gradientEnd}, ${colors.primaryHover})`,
} as const;

export const radii = {
  sm: '8px',
  md: '10px',
  lg: '12px',
  full: '999px',
} as const;

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  xxl: '24px',
} as const;
