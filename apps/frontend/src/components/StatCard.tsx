import { TRUST_GREEN, WARNING_AMBER, DANGER_RED, NEUTRAL_GRAY } from '../styles/tokens';

const BORDER_COLOR: Record<string, string> = {
  success: TRUST_GREEN,
  warning: WARNING_AMBER,
  danger: DANGER_RED,
  neutral: NEUTRAL_GRAY,
};

interface StatCardProps {
  value: string | number;
  label: string;
  tone: 'success' | 'warning' | 'danger' | 'neutral';
  icon?: React.ReactNode;
}

export default function StatCard({ value, label, tone, icon }: StatCardProps) {
  const borderColor = BORDER_COLOR[tone];

  return (
    <div
      style={{
        borderLeft: `4px solid ${borderColor}`,
        background: '#ffffff',
        borderRadius: '8px',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      }}
    >
      {icon && (
        <span style={{ fontSize: '20px', lineHeight: 1, marginTop: '2px' }}>{icon}</span>
      )}
      <div>
        <div style={{ fontSize: '28px', fontWeight: 700, lineHeight: 1, color: '#111827' }}>
          {value}
        </div>
        <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>{label}</div>
      </div>
    </div>
  );
}
