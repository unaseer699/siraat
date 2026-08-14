import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PropertyIntelligenceService } from './property-intelligence.service';
import { SocietyEntity } from './entities/society.entity';
import { PropertyEntity } from './entities/property.entity';
import { DeveloperEntity } from './entities/developer.entity';

describe('PropertyIntelligenceService', () => {
  let service: PropertyIntelligenceService;
  let qbMocks: { select: jest.Mock; getRawMany: jest.Mock };

  beforeEach(async () => {
    qbMocks = {
      select: jest.fn(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    qbMocks.select.mockReturnValue(qbMocks);

    const module = await Test.createTestingModule({
      providers: [
        PropertyIntelligenceService,
        {
          provide: getRepositoryToken(SocietyEntity),
          useValue: { createQueryBuilder: jest.fn(() => qbMocks) },
        },
        { provide: getRepositoryToken(PropertyEntity), useValue: {} },
        { provide: getRepositoryToken(DeveloperEntity), useValue: {} },
      ],
    }).compile();

    service = module.get(PropertyIntelligenceService);
  });

  describe('listDistinctCities', () => {
    it('returns distinct city values, sorted', async () => {
      qbMocks.getRawMany.mockResolvedValue([
        { city: 'Rawalpindi' },
        { city: 'Islamabad' },
      ]);

      const result = await service.listDistinctCities();

      expect(result).toEqual(['Islamabad', 'Rawalpindi']);
      expect(qbMocks.select).toHaveBeenCalledWith('DISTINCT s.city', 'city');
    });

    it('returns an empty array gracefully on an empty database (no rows, no error)', async () => {
      qbMocks.getRawMany.mockResolvedValue([]);

      const result = await service.listDistinctCities();

      expect(result).toEqual([]);
    });
  });
});
