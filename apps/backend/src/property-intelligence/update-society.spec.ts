import { BadRequestException } from '@nestjs/common';
import { PropertyIntelligenceService } from './property-intelligence.service';

function makeSvc(existing: Record<string, unknown> | null, clash: { id: string } | null = null) {
  const svc = Object.create(PropertyIntelligenceService.prototype) as PropertyIntelligenceService;
  const bag = svc as unknown as Record<string, unknown>;
  const save = jest.fn(async (e: unknown) => e);
  bag['societyRepo'] = { findOneBy: jest.fn(async () => existing), save };
  bag['findSocietyByNameAndCity'] = jest.fn(async () => clash);
  const logObservation = jest.fn(async () => undefined);
  bag['logObservation'] = logObservation;
  return { svc, save, logObservation };
}

const base = () => ({
  id: 's1', name: 'B-17', city: 'Islamabad', min_price: '1000000', max_price: 5000000,
  min_area_marla: 5, max_area_marla: 20, property_types: ['PLOT'], noc_approved: false,
  base_confidence: '0.85', is_siraat_affiliated: false, affiliation_disclosure: null, noc_summary: null,
  source_document_ids: [], is_stale: false, staleness_threshold_days: 30, record_type: 'FACT', developer_id: null,
});

describe('PropertyIntelligenceService.updateSociety', () => {
  it('returns null for an unknown id', async () => {
    const { svc } = makeSvc(null);
    expect(await svc.updateSociety('x', { name: 'A' })).toBeNull();
  });
  it('saves only changed fields and logs one observation each', async () => {
    const { svc, save, logObservation } = makeSvc(base());
    const out = await svc.updateSociety('s1', { noc_approved: true, min_price: 1000000, city: 'Islamabad' });
    expect(save).toHaveBeenCalledTimes(1);
    expect(logObservation).toHaveBeenCalledTimes(1);
    expect(logObservation).toHaveBeenCalledWith(expect.objectContaining({ metric: 'society_edit', old_value: 'false', new_value: 'true' }));
    expect(out?.noc_approved).toBe(true);
  });
  it('does nothing when nothing changed', async () => {
    const { svc, save } = makeSvc(base());
    await svc.updateSociety('s1', { name: 'B-17' });
    expect(save).not.toHaveBeenCalled();
  });
  it('blocks a rename that collides with another society', async () => {
    const { svc } = makeSvc(base(), { id: 'other' });
    await expect(svc.updateSociety('s1', { name: 'Taken' })).rejects.toBeInstanceOf(BadRequestException);
  });
  it('rejects min greater than max', async () => {
    const { svc } = makeSvc(base());
    await expect(svc.updateSociety('s1', { min_price: 9, max_price: 1 })).rejects.toBeInstanceOf(BadRequestException);
  });
});
