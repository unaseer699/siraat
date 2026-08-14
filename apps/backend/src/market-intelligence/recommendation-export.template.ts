import type { RecommendationDetail } from '@siraat/shared-types';

// Chunk 1 of SAVE/SHARE: a downloadable report standing in for account-based
// bookmarking (no User/Identity system exists yet — see REVIEW_BACKLOG.md #9).
// Printable HTML was chosen over a PDF library for this pass — it needs no new
// binary dependency, prints cleanly via the browser's own "Save as PDF", and
// carries zero risk of a half-working PDF renderer. Revisit if a true PDF
// download becomes a hard requirement.

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatPKR(n: number): string {
  if (n >= 1e7) return `PKR ${(n / 1e7).toFixed(2)} Crore`;
  if (n >= 1e5) return `PKR ${(n / 1e5).toFixed(1)} Lakh`;
  return `PKR ${n.toLocaleString()}`;
}

function confidenceColor(score: number): string {
  return score >= 0.8 ? '#16a34a' : score >= 0.5 ? '#d97706' : '#dc2626';
}

const TONE_COLOR: Record<string, string> = {
  success: '#16a34a',
  warning: '#d97706',
  danger: '#dc2626',
  neutral: '#6b7280',
};

function toneColor(tone: string): string {
  return TONE_COLOR[tone] ?? TONE_COLOR.neutral;
}

const EVIDENCE_TYPE_LABEL: Record<string, string> = {
  document: 'Document',
  photo: 'Photo',
  receipt: 'Receipt',
  inspection_report: 'Inspection Report',
};

// Filename for the Content-Disposition header — society name slugified, id kept
// for uniqueness across re-downloads of the same report.
export function exportFilename(detail: RecommendationDetail): string {
  const slug = detail.society_name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return `siraat-report-${slug || 'society'}-${detail.id}.html`;
}

export function renderRecommendationExportHtml(detail: RecommendationDetail): string {
  const generatedAt = new Date().toISOString();
  const computedDate = new Date(detail.computed_at).toLocaleDateString('en-PK', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const breakdownRows = detail.breakdown
    ? [
        { category: 'Regulatory Status', label: detail.breakdown.regulatory.label, tone: detail.breakdown.regulatory.tone },
        { category: 'Active Issues', label: detail.breakdown.active_issues.label, tone: detail.breakdown.active_issues.tone },
        { category: 'Evidence Strength', label: detail.breakdown.evidence_strength.label, tone: detail.breakdown.evidence_strength.tone },
        { category: 'Data Freshness', label: detail.breakdown.data_freshness.checked_date, tone: detail.breakdown.data_freshness.tone },
      ]
    : [];

  const evidenceItems =
    detail.evidence_summaries.length > 0
      ? detail.evidence_summaries.map((e) => ({
          label: EVIDENCE_TYPE_LABEL[e.type] ?? e.type,
          ref: e.source_ref,
        }))
      : detail.derived_from.map((id) => ({ label: 'Source', ref: id }));

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Siraat Trust Report — ${escapeHtml(detail.society_name)}</title>
<style>
  body { font-family: -apple-system, "Segoe UI", Arial, sans-serif; color: #111827; max-width: 720px; margin: 0 auto; padding: 40px 24px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 15px; margin: 24px 0 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
  .muted { color: #6b7280; font-size: 13px; margin: 0; }
  .price { font-size: 22px; font-weight: 700; margin: 8px 0; }
  .score { font-size: 32px; font-weight: 800; margin: 4px 0 0; }
  .disclosure { background: #fffbeb; border: 2px solid #f59e0b; border-radius: 8px; padding: 14px 16px; margin: 16px 0; }
  .disclosure .title { font-size: 12px; font-weight: 700; color: #92400e; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  td { text-align: left; padding: 8px 0; font-size: 13px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
  .tone-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 8px; }
  ul { list-style: none; padding: 0; margin: 8px 0; }
  li { padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-size: 13px; }
  footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <p class="muted">SIRAAT TRUST REPORT</p>
  <h1>${escapeHtml(detail.title)}</h1>
  <p class="muted">${escapeHtml(detail.society_name)}</p>
  <p class="price">${formatPKR(detail.price)}</p>
  ${
    detail.is_stale
      ? `<p style="color:#d97706;font-size:13px;">⚠ Data may be stale (threshold: ${detail.staleness_threshold_days} days)</p>`
      : ''
  }

  ${
    detail.affiliation_disclosure
      ? `<div class="disclosure">
    <div class="title">AFFILIATION DISCLOSURE</div>
    <div>${escapeHtml(detail.affiliation_disclosure)}</div>
  </div>`
      : ''
  }

  <h2>Confidence score</h2>
  <p class="score" style="color:${confidenceColor(detail.confidence_score)}">
    ${Math.round(detail.confidence_score * 100)}%
  </p>

  <h2>Score breakdown</h2>
  ${
    breakdownRows.length > 0
      ? `<table>
    ${breakdownRows
      .map(
        (row) => `<tr>
      <td style="width:180px;font-weight:700;">${escapeHtml(row.category)}</td>
      <td><span class="tone-dot" style="background:${toneColor(row.tone)}"></span>${escapeHtml(row.label)}</td>
    </tr>`,
      )
      .join('')}
  </table>`
      : `<p class="muted">Breakdown not available for this score.</p>`
  }

  <h2>Why Siraat recommends this</h2>
  <p>${escapeHtml(detail.reasoning_summary)}</p>

  <h2>Evidence cited (${evidenceItems.length})</h2>
  <ul>
    ${evidenceItems
      .map((item) => `<li><strong>${escapeHtml(item.label)}</strong><br/>${escapeHtml(item.ref)}</li>`)
      .join('')}
  </ul>

  <footer>
    Score computed on ${computedDate} &middot; record_type: ${detail.record_type}<br/>
    Report generated ${generatedAt}
  </footer>
</body>
</html>
`;
}
