import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In } from 'typeorm';
import { ConstructionProjectService } from './construction-project.service';
import { ConstructionProjectEntity } from './entities/construction-project.entity';
import { ProjectSectionEntity } from './entities/project-section.entity';
import { ProjectExpenseEntity } from './entities/project-expense.entity';

describe('ConstructionProjectService', () => {
  let service: ConstructionProjectService;

  let projectCreateMock: jest.Mock;
  let projectSaveMock: jest.Mock;
  let projectFindOneByMock: jest.Mock;

  let sectionCreateMock: jest.Mock;
  let sectionSaveMock: jest.Mock;
  let sectionFindOneByMock: jest.Mock;
  let sectionFindMock: jest.Mock;

  let expenseCreateMock: jest.Mock;
  let expenseSaveMock: jest.Mock;
  let expenseFindMock: jest.Mock;

  beforeEach(async () => {
    projectCreateMock = jest.fn((data) => data);
    projectSaveMock = jest.fn((entity) => Promise.resolve({ id: 'proj-new-uuid', ...entity }));
    projectFindOneByMock = jest.fn().mockResolvedValue(null);

    sectionCreateMock = jest.fn((data) => data);
    sectionSaveMock = jest.fn((entity) => Promise.resolve({ id: 'sec-new-uuid', ...entity }));
    sectionFindOneByMock = jest.fn().mockResolvedValue(null);
    sectionFindMock = jest.fn().mockResolvedValue([]);

    expenseCreateMock = jest.fn((data) => data);
    expenseSaveMock = jest.fn((entity) => Promise.resolve({ id: 'exp-new-uuid', ...entity }));
    expenseFindMock = jest.fn().mockResolvedValue([]);

    const module = await Test.createTestingModule({
      providers: [
        ConstructionProjectService,
        {
          provide: getRepositoryToken(ConstructionProjectEntity),
          useValue: {
            create: projectCreateMock,
            save: projectSaveMock,
            findOneBy: projectFindOneByMock,
          },
        },
        {
          provide: getRepositoryToken(ProjectSectionEntity),
          useValue: {
            create: sectionCreateMock,
            save: sectionSaveMock,
            findOneBy: sectionFindOneByMock,
            find: sectionFindMock,
          },
        },
        {
          provide: getRepositoryToken(ProjectExpenseEntity),
          useValue: {
            create: expenseCreateMock,
            save: expenseSaveMock,
            find: expenseFindMock,
          },
        },
      ],
    }).compile();

    service = module.get(ConstructionProjectService);
  });

  function buildProjectInput(overrides: object = {}) {
    return {
      name: 'Bahria 1180',
      property_ref: null,
      owner_contact: '+92 300 1112222',
      start_date: '2026-01-15',
      status: 'ACTIVE' as const,
      ...overrides,
    };
  }

  describe('createProject', () => {
    it('creates a project with all fields', async () => {
      const result = await service.createProject(buildProjectInput());

      expect(projectCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Bahria 1180', record_type: 'FACT' }),
      );
      expect(result.name).toBe('Bahria 1180');
      expect(result.property_ref).toBeNull();
      expect(result.status).toBe('ACTIVE');
      expect(result.record_type).toBe('FACT');
    });

    it('accepts a non-null property_ref (optional link to a Society/Property)', async () => {
      const result = await service.createProject(buildProjectInput({ property_ref: 'prop-uuid-001' }));
      expect(result.property_ref).toBe('prop-uuid-001');
    });
  });

  describe('findProjectById', () => {
    it('returns the project when found', async () => {
      projectFindOneByMock.mockResolvedValue({ id: 'proj-a-uuid', ...buildProjectInput(), record_type: 'FACT' });

      const result = await service.findProjectById('proj-a-uuid');

      expect(result).not.toBeNull();
      expect(result!.name).toBe('Bahria 1180');
    });

    it('returns null when no project matches the id', async () => {
      projectFindOneByMock.mockResolvedValue(null);

      const result = await service.findProjectById('non-existent-uuid');

      expect(result).toBeNull();
    });
  });

  describe('createSection', () => {
    it('creates a section scoped to the given project id', async () => {
      const result = await service.createSection('proj-a-uuid', { category: 'WOODWORK_CARPENTER', display_order: 1 });

      expect(sectionCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({ project_ref: 'proj-a-uuid', category: 'WOODWORK_CARPENTER', record_type: 'FACT' }),
      );
      expect(result.project_ref).toBe('proj-a-uuid');
      expect(result.category).toBe('WOODWORK_CARPENTER');
      expect(result.display_order).toBe(1);
    });

    it('accepts the newly-extended TRADE_CATEGORIES values (KITCHEN_WORK, MISCELLANEOUS)', async () => {
      const kitchen = await service.createSection('proj-a-uuid', { category: 'KITCHEN_WORK', display_order: 2 });
      const misc = await service.createSection('proj-a-uuid', { category: 'MISCELLANEOUS', display_order: 3 });

      expect(kitchen.category).toBe('KITCHEN_WORK');
      expect(misc.category).toBe('MISCELLANEOUS');
    });
  });

  describe('findSectionById', () => {
    it('returns the section when found', async () => {
      sectionFindOneByMock.mockResolvedValue({
        id: 'sec-a-uuid',
        project_ref: 'proj-a-uuid',
        category: 'TILE_WORK',
        display_order: 1,
        record_type: 'FACT',
      });

      const result = await service.findSectionById('sec-a-uuid');

      expect(result).not.toBeNull();
      expect(result!.category).toBe('TILE_WORK');
    });

    it('returns null when no section matches the id', async () => {
      sectionFindOneByMock.mockResolvedValue(null);

      const result = await service.findSectionById('non-existent-uuid');

      expect(result).toBeNull();
    });
  });

  function buildExpenseInput(overrides: object = {}) {
    return {
      expense_date: '2026-01-20',
      description: 'Cupboards and shelving',
      vendor_name: 'Malik Woodworks',
      vendor_contact: '+92 300 3334444',
      linked_contractor_id: null,
      linked_supplier_id: null,
      amount: 45000,
      ...overrides,
    };
  }

  describe('createExpense', () => {
    it('creates an expense scoped to the given section id', async () => {
      const result = await service.createExpense('sec-a-uuid', buildExpenseInput());

      expect(expenseCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({ section_ref: 'sec-a-uuid', amount: 45000, record_type: 'FACT' }),
      );
      expect(result.section_ref).toBe('sec-a-uuid');
      expect(result.amount).toBe(45000);
      expect(result.vendor_name).toBe('Malik Woodworks');
    });

    it('converts a string-typed decimal amount column back to a number', async () => {
      // pg/TypeORM returns `decimal` columns as strings — same conversion
      // ConstructionIntelligenceService's toResult relies on for price.
      expenseSaveMock.mockResolvedValue({
        id: 'exp-new-uuid',
        section_ref: 'sec-a-uuid',
        ...buildExpenseInput(),
        amount: '45000.00',
        record_type: 'FACT',
      });

      const result = await service.createExpense('sec-a-uuid', buildExpenseInput());

      expect(result.amount).toBe(45000);
      expect(typeof result.amount).toBe('number');
    });

    it('leaves vendor free-text (linked_contractor_id/linked_supplier_id null) when no directory link is given', async () => {
      const result = await service.createExpense('sec-a-uuid', buildExpenseInput());

      expect(result.linked_contractor_id).toBeNull();
      expect(result.linked_supplier_id).toBeNull();
      expect(result.vendor_name).toBe('Malik Woodworks');
    });

    it('accepts an optional linked_contractor_id when the vendor is a real Contractor', async () => {
      const result = await service.createExpense(
        'sec-a-uuid',
        buildExpenseInput({ linked_contractor_id: 'con-uuid-001' }),
      );

      expect(result.linked_contractor_id).toBe('con-uuid-001');
      expect(result.linked_supplier_id).toBeNull();
    });

    it('accepts an optional linked_supplier_id when the vendor is a real Supplier', async () => {
      const result = await service.createExpense(
        'sec-a-uuid',
        buildExpenseInput({ linked_supplier_id: 'sup-uuid-001' }),
      );

      expect(result.linked_supplier_id).toBe('sup-uuid-001');
      expect(result.linked_contractor_id).toBeNull();
    });

    it('accepts a negative amount — the only sanctioned way to correct a prior expense', async () => {
      const result = await service.createExpense(
        'sec-a-uuid',
        buildExpenseInput({ amount: -10000, description: 'Correction: overbilled cupboard installation' }),
      );

      expect(result.amount).toBe(-10000);
    });
  });

  // ADMIN CRUD PHASE 1 / PROJECT COST TRACKER Chunk 1 — Law 3: FACT records
  // are immutable. Corrections are a new createExpense call, never an
  // edit-in-place. Enforced structurally: no update/edit method for
  // ProjectExpenseEntity exists anywhere on this service.
  describe('immutability — no update-in-place path for expenses', () => {
    it('has no updateExpense/editExpense/patchExpense method on the service', () => {
      const svc = service as unknown as Record<string, unknown>;
      expect(svc.updateExpense).toBeUndefined();
      expect(svc.editExpense).toBeUndefined();
      expect(svc.patchExpense).toBeUndefined();
    });

    it('exposes no method name matching /update|edit|patch/i anywhere on the prototype (case: expenses only ever get created)', () => {
      const proto = Object.getPrototypeOf(service);
      const methodNames = Object.getOwnPropertyNames(proto).filter((name) => name !== 'constructor');
      const mutatingNames = methodNames.filter((name) => /update|edit|patch/i.test(name));
      expect(mutatingNames).toEqual([]);
    });
  });

  describe('getProjectWithSectionsAndExpenses', () => {
    it('returns null when no project matches the id', async () => {
      projectFindOneByMock.mockResolvedValue(null);

      const result = await service.getProjectWithSectionsAndExpenses('non-existent-uuid');

      expect(result).toBeNull();
    });

    it('returns a project with no sections (empty array, total 0) without querying expenses', async () => {
      projectFindOneByMock.mockResolvedValue({
        id: 'proj-a-uuid',
        ...buildProjectInput(),
        record_type: 'FACT',
      });
      sectionFindMock.mockResolvedValue([]);

      const result = await service.getProjectWithSectionsAndExpenses('proj-a-uuid');

      expect(result).not.toBeNull();
      expect(result!.sections).toEqual([]);
      expect(result!.total).toBe(0);
      expect(expenseFindMock).not.toHaveBeenCalled();
    });

    // ─── Bahria 1180-shaped fixture: multiple sections, multiple expenses each ───
    it('returns the correct nested structure with accurate total and per-section subtotals', async () => {
      projectFindOneByMock.mockResolvedValue({
        id: 'proj-bahria-uuid',
        name: 'Bahria 1180',
        property_ref: null,
        owner_contact: '+92 300 1112222',
        start_date: '2026-01-15',
        status: 'ACTIVE',
        record_type: 'FACT',
      });

      const WOOD_SECTION = {
        id: 'sec-wood-uuid',
        project_ref: 'proj-bahria-uuid',
        category: 'WOODWORK_CARPENTER',
        display_order: 1,
        record_type: 'FACT',
      };
      const TILE_SECTION = {
        id: 'sec-tile-uuid',
        project_ref: 'proj-bahria-uuid',
        category: 'TILE_WORK',
        display_order: 2,
        record_type: 'FACT',
      };
      const ELECTRIC_SECTION = {
        id: 'sec-electric-uuid',
        project_ref: 'proj-bahria-uuid',
        category: 'ELECTRICIAN',
        display_order: 3,
        record_type: 'FACT',
      };
      sectionFindMock.mockResolvedValue([WOOD_SECTION, TILE_SECTION, ELECTRIC_SECTION]);

      const WOOD_EXPENSES = [
        { id: 'exp-1', section_ref: 'sec-wood-uuid', expense_date: '2026-01-20', description: 'Cupboards', vendor_name: 'Malik Woodworks', vendor_contact: null, linked_contractor_id: null, linked_supplier_id: null, amount: '45000.00', record_type: 'FACT' },
        { id: 'exp-2', section_ref: 'sec-wood-uuid', expense_date: '2026-01-25', description: 'Wardrobes', vendor_name: 'Malik Woodworks', vendor_contact: null, linked_contractor_id: null, linked_supplier_id: null, amount: '30000.00', record_type: 'FACT' },
      ];
      const TILE_EXPENSES = [
        { id: 'exp-3', section_ref: 'sec-tile-uuid', expense_date: '2026-02-01', description: 'Bathroom tiling', vendor_name: 'Ali Tiles', vendor_contact: null, linked_contractor_id: 'con-uuid-001', linked_supplier_id: null, amount: '60000.00', record_type: 'FACT' },
      ];
      const ELECTRIC_EXPENSES = [
        { id: 'exp-4', section_ref: 'sec-electric-uuid', expense_date: '2026-02-05', description: 'Wiring', vendor_name: 'City Electric', vendor_contact: null, linked_contractor_id: null, linked_supplier_id: null, amount: '25000.00', record_type: 'FACT' },
        { id: 'exp-5', section_ref: 'sec-electric-uuid', expense_date: '2026-02-10', description: 'Fixtures', vendor_name: 'City Electric', vendor_contact: null, linked_contractor_id: null, linked_supplier_id: 'sup-uuid-001', amount: '15000.00', record_type: 'FACT' },
        // A correction: overbilled fixtures, entered as a negative amount rather than editing exp-5.
        { id: 'exp-6', section_ref: 'sec-electric-uuid', expense_date: '2026-02-11', description: 'Correction: overbilled fixtures', vendor_name: 'City Electric', vendor_contact: null, linked_contractor_id: null, linked_supplier_id: null, amount: '-5000.00', record_type: 'FACT' },
      ];
      expenseFindMock.mockResolvedValue([...WOOD_EXPENSES, ...TILE_EXPENSES, ...ELECTRIC_EXPENSES]);

      const result = await service.getProjectWithSectionsAndExpenses('proj-bahria-uuid');

      expect(result).not.toBeNull();
      expect(result!.name).toBe('Bahria 1180');
      expect(expenseFindMock).toHaveBeenCalledWith(
        expect.objectContaining({ where: { section_ref: In(['sec-wood-uuid', 'sec-tile-uuid', 'sec-electric-uuid']) } }),
      );

      // Sections preserve display_order.
      expect(result!.sections.map((s) => s.category)).toEqual(['WOODWORK_CARPENTER', 'TILE_WORK', 'ELECTRICIAN']);

      const wood = result!.sections.find((s) => s.category === 'WOODWORK_CARPENTER')!;
      const tile = result!.sections.find((s) => s.category === 'TILE_WORK')!;
      const electric = result!.sections.find((s) => s.category === 'ELECTRICIAN')!;

      expect(wood.expenses).toHaveLength(2);
      expect(wood.subtotal).toBe(75000); // 45000 + 30000

      expect(tile.expenses).toHaveLength(1);
      expect(tile.subtotal).toBe(60000);
      expect(tile.expenses[0].linked_contractor_id).toBe('con-uuid-001');

      expect(electric.expenses).toHaveLength(3);
      expect(electric.subtotal).toBe(35000); // 25000 + 15000 - 5000
      expect(electric.expenses[2].amount).toBe(-5000);
      expect(electric.expenses[1].linked_supplier_id).toBe('sup-uuid-001');

      // Grand total = sum of every expense amount across every section.
      expect(result!.total).toBe(75000 + 60000 + 35000);
      expect(result!.total).toBe(170000);
    });
  });
});
