'use client';

import { RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts';
import { TRUST_GREEN, WARNING_AMBER, DANGER_RED } from '../styles/tokens';

export function confidenceColor(score: number): string {
  return score >= 0.8 ? TRUST_GREEN : score >= 0.5 ? WARNING_AMBER : DANGER_RED;
}

interface Props {
  score: number;
  size?: 'sm' | 'lg';
}

const SIZE_META = {
  sm: { box: 90, cx: 45, cy: 45, innerRadius: 30, outerRadius: 44, barSize: 14, cornerRadius: 7, pctFontSize: '14px', caption: 'trust' },
  lg: { box: 140, cx: 70, cy: 70, innerRadius: 50, outerRadius: 68, barSize: 18, cornerRadius: 9, pctFontSize: '26px', caption: 'confidence' },
} as const;

export function ConfidenceGauge({ score, size = 'sm' }: Props) {
  const pct = Math.round(score * 100);
  const color = confidenceColor(score);
  const meta = SIZE_META[size];
  const data = [{ value: pct, fill: color }];

  const gauge = (
    <div style={{ position: 'relative', width: meta.box, height: meta.box, flexShrink: 0 }}>
      <RadialBarChart
        width={meta.box}
        height={meta.box}
        cx={meta.cx}
        cy={meta.cy}
        innerRadius={meta.innerRadius}
        outerRadius={meta.outerRadius}
        barSize={meta.barSize}
        data={data}
        startAngle={90}
        endAngle={-270}
      >
        <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
        <RadialBar dataKey="value" cornerRadius={meta.cornerRadius} background={{ fill: '#e5e7eb' }} />
      </RadialBarChart>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <span style={{ fontSize: meta.pctFontSize, fontWeight: 800, color, lineHeight: 1 }}>{pct}%</span>
        <span style={{ fontSize: size === 'lg' ? '11px' : '9px', color: '#6b7280', fontWeight: 600, marginTop: '2px' }}>
          {meta.caption}
        </span>
      </div>
    </div>
  );

  if (size !== 'lg') return gauge;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
      {gauge}
      <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>Trust confidence</span>
    </div>
  );
}
