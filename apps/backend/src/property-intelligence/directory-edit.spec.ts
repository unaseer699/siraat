import { BadRequestException } from '@nestjs/common';
import { PropertyIntelligenceService } from './property-intelligence.service';

function build(clash: { id: string } | null) {
  const entity: Record<string, unknown> = { id: 'c1', name: 'Ali Builders', service_cities: ['Islamabad'], contact_phone: '0300', is_siraat_affiliated: false };
  const logged: { metric: string; old_value: string | null; new_value: string }[] = [];
  const saves: number[] = [];
  const svc = Object.create(PropertyIntelligenceService.prototype) as PropertyIntelligenceService;
  Object.assign(svc, {
    contractorRepo: { findOneBy: async () => entity, save: async (e: object) => (saves.push(1), e), delete: async () => ({ affected: 1 }) },
    findContractorByName: async () => clash,
    findContractorById: async () => ({ id: 'c1', ...entity }),
    logObservation: async (o: { metric: string; old_value: string | null; new_value: string }) => void logged.push(o),
  });
  return { svc, logged, saves, entity };
}

describe('PropertyIntelligenceService.updateContractor', () => {
  it('saves changed fields and logs each as an observation', async () => {
    const { svc, logged, entity } = build(null);
    await svc.updateContractor('c1', { contact_phone: '0311', service_cities: ['Islamabad', 'Rawalpindi'] });
    expect(entity.contact_phone).toBe('0311');
    expect(logged.map((l) => l.metric)).toEqual(['contractor_edit', 'contractor_edit']);
    expect(logged[0]).toMatchObject({ old_value: '0300', new_value: '0311' });
  });

  it('does nothing when nothing changed', async () => {
    const { svc, saves, logged } = build(null);
    await svc.updateContractor('c1', { contact_phone: '0300' });
    expect(saves).toHaveLength(0);
    expect(logged).toHaveLength(0);
  });

  it('blocks renaming onto another contractor', async () => {
    const { svc } = build({ id: 'other' });
    await expect(svc.updateContractor('c1', { name: 'Taken Name' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows renaming that only changes case of its own name', async () => {
    const { svc } = build({ id: 'other' });
    await expect(svc.updateContractor('c1', { name: 'ali builders' })).resolves.toBeTruthy();
  });
});
