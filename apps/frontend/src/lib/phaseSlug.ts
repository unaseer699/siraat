export function phaseSlug(label: string): string {
  return 'phase-' + label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
