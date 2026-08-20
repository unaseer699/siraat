export const TRUST_GREEN = '#16a34a';
export const WARNING_AMBER = '#d97706';
export const DANGER_RED = '#dc2626';
export const NEUTRAL_GRAY = '#6b7280';

// Mirrors --brand in globals.css (#1a56db). tokens.ts had no TS-side accent
// constant until now — kept as a real token (rather than a local copy) so a
// component that needs the accent color as a literal hex (e.g. to build an
// alpha-suffixed tint like `${ACCENT_BLUE}18`, which a CSS var can't do
// inline) has one source of truth instead of starting a silent second copy.
export const ACCENT_BLUE = '#1a56db';

// The "muted TRUST_GREEN" bg/border/text trio already used inline across
// verified/success panels app-wide (e.g. society/[id]'s claim-added panel,
// StatusBadge's VERIFIED treatment, admin success banners). Named here so
// any new usage (e.g. the home page hero band) references one source
// instead of re-typing the same three hex literals again.
export const TRUST_GREEN_BG = '#f0fdf4';
export const TRUST_GREEN_BORDER = '#bbf7d0';
export const TRUST_GREEN_TEXT = '#166534';

export const SPACING = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '40px',
} as const;

export const RADIUS = {
  sm: '4px',
  md: '8px',
  lg: '12px',
} as const;
