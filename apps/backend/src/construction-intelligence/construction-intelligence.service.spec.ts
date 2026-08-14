import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConstructionIntelligenceService } from './construction-intelligence.service';
import { MaterialRateEntity } from './entities/material-rate.entity';

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function buildInput(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    material_name: 'Cement - OPC 50kg bag',
    unit: 'per bag',
    price: 1550,
    city: 'Islamabad',
    source_tier: 'SUPPLIER_VERIFIED' as const,
    source_name: 'Al-Rehman Traders',
    source_contact: '+92 300 1234567',
    recorded_date: isoDaysAgo(0),
    ...overrides,
  };
}

describe('ConstructionIntelligenceService', () => {
  let service: ConstructionIntelligenceService;
  let createMock: jest.Mock;
  let saveMock: jest.Mock;
  let qbMocks: { andWhere: jest.Mock; orderBy: jest.Mock; getMany: jest.Mock };

  beforeEach(async () => {
    createMock = jest.fn((data) => data);
    saveMock = jest.fn((entity) =>
      Promise.resolve({ id: 'rate-uuid-001', created_at: new Date(), ...entity }),
    );
    qbMocks = {
      andWhere: jest.fn(),
      orderBy: jest.fn(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    qbMocks.andWhere.mockReturnValue(qbMocks);
    qbMocks.orderBy.mockReturnValue(qbMocks);

    const module = await Test.createTestingModule({
      providers: [
        ConstructionIntelligenceService,
        {
          provide: getRepositoryToken(MaterialRateEntity),
          useValue: {
            create: createMock,
            save: saveMock,
            createQueryBuilder: jest.fn(() => qbMocks),
          },
        },
      ],
    }).compile();

    service = module.get(ConstructionIntelligenceService);
  });

  describe('createMaterialRate', () => {
    it('rejects a SUPPLIER_VERIFIED rate with no source_contact', async () => {
      await expect(
        service.createMaterialRate(buildInput({ source_contact: null })),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(saveMock).not.toHaveBeenCalled();
    });

    it('accepts a MARKET_REFERENCE rate with no source_contact', async () => {
      const result = await service.createMaterialRate(
        buildInput({
          source_tier: 'MARKET_REFERENCE',
          source_name: 'civilconstructionguide.com',
          source_contact: null,
        }),
      );
      expect(result.source_contact).toBeNull();
      expect(saveMock).toHaveBeenCalled();
    });

    it('sets record_type to FACT', async () => {
      const result = await service.createMaterialRate(buildInput());
      expect(result.record_type).toBe('FACT');
    });

    it('a 10-day-old SUPPLIER_VERIFIED (Tier 1) rate is fresh — threshold is 14 days', async () => {
      const result = await service.createMaterialRate(
        buildInput({ recorded_date: isoDaysAgo(10) }),
      );
      expect(result.is_stale).toBe(false);
      expect(result.staleness_threshold_days).toBe(14);
    });

    it('a 10-day-old MARKET_REFERENCE (Tier 2) rate is stale — threshold is 7 days', async () => {
      const result = await service.createMaterialRate(
        buildInput({
          source_tier: 'MARKET_REFERENCE',
          source_contact: null,
          recorded_date: isoDaysAgo(10),
        }),
      );
      expect(result.is_stale).toBe(true);
      expect(result.staleness_threshold_days).toBe(7);
    });
  });

  describe('listMaterialRates', () => {
    it('filters by city and material when provided', async () => {
      await service.listMaterialRates({ city: 'Islamabad', material: 'Cement' });
      expect(qbMocks.andWhere).toHaveBeenCalledTimes(2);
    });

    it('applies no filters when none provided', async () => {
      await service.listMaterialRates({});
      expect(qbMocks.andWhere).not.toHaveBeenCalled();
    });
  });
});
