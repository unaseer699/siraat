import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PropertyIntelligenceService } from './property-intelligence.service';
import { SocietyEntity } from './entities/society.entity';
import { PropertyEntity } from './entities/property.entity';
import { DeveloperEntity } from './entities/developer.entity';
import { TrustService } from '../trust/trust.service';

describe('PropertyIntelligenceService', () => {
  let service: PropertyIntelligenceService;
  let qbMocks: {
    select: jest.Mock;
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    skip: jest.Mock;
    take: jest.Mock;
    getRawMany: jest.Mock;
    getManyAndCount: jest.Mock;
  };
  let deriveVerificationStatusMock: jest.Mock;

  beforeEach(async () => {
    qbMocks = {
      select: jest.fn(),
      andWhere: jest.fn(),
      orderBy: jest.fn(),
      skip: jest.fn(),
      take: jest.fn(),
      getRawMany: jest.fn().mockResolvedValue([]),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    qbMocks.select.mockReturnValue(qbMocks);
    qbMocks.andWhere.mockReturnValue(qbMocks);
    qbMocks.orderBy.mockReturnValue(qbMocks);
    qbMocks.skip.mockReturnValue(qbMocks);
    qbMocks.take.mockReturnValue(qbMocks);

    deriveVerificationStatusMock = jest.fn().mockResolvedValue('PENDING');

    const module = await Test.createTestingModule({
      providers: [
        PropertyIntelligenceService,
        {
          provide: getRepositoryToken(SocietyEntity),
          useValue: { createQueryBuilder: jest.fn(() => qbMocks) },
        },
        { provide: getRepositoryToken(PropertyEntity), useValue: {} },
        { provide: getRepositoryToken(DeveloperEntity), useValue: {} },
        {
          provide: TrustService,
          useValue: { deriveVerificationStatus: deriveVerificationStatusMock },
        },
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

  // ─── BROWSE SOCIETIES Chunk 1 ────────────────────────────────────────────────

  describe('listSocieties', () => {
    const SOCIETY_A: Partial<SocietyEntity> = {
      id: 'soc-a-uuid',
      name: 'Taj Residencia',
      city: 'Rawalpindi',
      min_price: 5000000,
      max_price: 15000000,
      min_area_marla: 5,
      max_area_marla: 20,
      property_types: ['plot', 'house'],
    };
    const SOCIETY_B: Partial<SocietyEntity> = {
      id: 'soc-b-uuid',
      name: 'Bahria Town',
      city: 'Islamabad',
      min_price: 8000000,
      max_price: 30000000,
      min_area_marla: 5,
      max_area_marla: 20,
      property_types: ['plot'],
    };

    it('returns paginated results with total_count, page, and total_pages', async () => {
      qbMocks.getManyAndCount.mockResolvedValue([[SOCIETY_A, SOCIETY_B], 2]);

      const result = await service.listSocieties({ page: 1, limit: 20 });

      expect(result.societies).toHaveLength(2);
      expect(result.total_count).toBe(2);
      expect(result.page).toBe(1);
      expect(result.total_pages).toBe(1);
      expect(qbMocks.skip).toHaveBeenCalledWith(0);
      expect(qbMocks.take).toHaveBeenCalledWith(20);
    });

    it('maps price_range, area_range, and property_types from the entity', async () => {
      qbMocks.getManyAndCount.mockResolvedValue([[SOCIETY_A], 1]);

      const result = await service.listSocieties({});

      expect(result.societies[0]).toMatchObject({
        id: 'soc-a-uuid',
        name: 'Taj Residencia',
        city: 'Rawalpindi',
        price_range: { min: 5000000, max: 15000000 },
        area_range: { min: 5, max: 20 },
        property_types: ['plot', 'house'],
      });
    });

    it('derives verification_status per society via TrustService (reused, not re-implemented)', async () => {
      qbMocks.getManyAndCount.mockResolvedValue([[SOCIETY_A, SOCIETY_B], 2]);
      deriveVerificationStatusMock
        .mockResolvedValueOnce('VERIFIED')
        .mockResolvedValueOnce('DISPUTED');

      const result = await service.listSocieties({});

      expect(deriveVerificationStatusMock).toHaveBeenCalledWith('SOCIETY', 'soc-a-uuid');
      expect(deriveVerificationStatusMock).toHaveBeenCalledWith('SOCIETY', 'soc-b-uuid');
      expect(result.societies.find((s) => s.id === 'soc-a-uuid')!.verification_status).toBe('VERIFIED');
      expect(result.societies.find((s) => s.id === 'soc-b-uuid')!.verification_status).toBe('DISPUTED');
    });

    it('applies the city filter case-insensitively', async () => {
      qbMocks.getManyAndCount.mockResolvedValue([[SOCIETY_A], 1]);

      await service.listSocieties({ city: 'rawalpindi' });

      expect(qbMocks.andWhere).toHaveBeenCalledWith('LOWER(s.city) = LOWER(:city)', {
        city: 'rawalpindi',
      });
    });

    it('does not filter by city when none is provided', async () => {
      qbMocks.getManyAndCount.mockResolvedValue([[], 0]);

      await service.listSocieties({});

      expect(qbMocks.andWhere).not.toHaveBeenCalled();
    });

    it('returns an empty array, not an error, on an empty database', async () => {
      qbMocks.getManyAndCount.mockResolvedValue([[], 0]);

      const result = await service.listSocieties({});

      expect(result.societies).toEqual([]);
      expect(result.total_count).toBe(0);
      expect(result.total_pages).toBe(0);
    });

    it('defaults to page 1 and limit 20 when not provided', async () => {
      qbMocks.getManyAndCount.mockResolvedValue([[], 0]);

      const result = await service.listSocieties({});

      expect(result.page).toBe(1);
      expect(qbMocks.skip).toHaveBeenCalledWith(0);
      expect(qbMocks.take).toHaveBeenCalledWith(20);
    });
  });
});
