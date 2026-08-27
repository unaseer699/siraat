import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { In } from 'typeorm';
import { ConstructionProjectService } from './construction-project.service';
import { ConstructionIntelligenceService } from './construction-intelligence.service';
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
  let expenseFindOneByMock: jest.Mock;
  let expenseUpdateMock: jest.Mock;

  // The transactional manager passed into expenseRepo.manager.transaction()'s
  // callback in editExpense — separate mocks from the plain repo above since
  // TypeORM's transactional EntityManager is a distinct object.
  let managerCreateMock: jest.Mock;
  let managerSaveMock: jest.Mock;
  let managerUpdateMock: jest.Mock;

  let logObservationMock: jest.Mock;

  // ADMIN PROJECTS LIST — same chainable-mock shape as
  // PropertyIntelligenceService.spec.ts's qbMocks/contractorQbMocks.
  let projectQbMocks: {
    orderBy: jest.Mock;
    skip: jest.Mock;
    take: jest.Mock;
    getManyAndCount: jest.Mock;
  };
  let expenseSumQbMocks: {
    innerJoin: jest.Mock;
    select: jest.Mock;
    addSelect: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    groupBy: jest.Mock;
    getRawMany: jest.Mock;
  };

  beforeEach(async () => {
    projectCreateMock = jest.fn((data) => data);
    projectSaveMock = jest.fn((entity) => Promise.resolve({ id: 'proj-new-uuid', ...entity }));
    projectFindOneByMock = jest.fn().mockResolvedValue(null);

    projectQbMocks = {
      orderBy: jest.fn(),
      skip: jest.fn(),
      take: jest.fn(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    projectQbMocks.orderBy.mockReturnValue(projectQbMocks);
    projectQbMocks.skip.mockReturnValue(projectQbMocks);
    projectQbMocks.take.mockReturnValue(projectQbMocks);

    expenseSumQbMocks = {
      innerJoin: jest.fn(),
      select: jest.fn(),
      addSelect: jest.fn(),
      where: jest.fn(),
      andWhere: jest.fn(),
      groupBy: jest.fn(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    expenseSumQbMocks.innerJoin.mockReturnValue(expenseSumQbMocks);
    expenseSumQbMocks.select.mockReturnValue(expenseSumQbMocks);
    expenseSumQbMocks.addSelect.mockReturnValue(expenseSumQbMocks);
    expenseSumQbMocks.where.mockReturnValue(expenseSumQbMocks);
    expenseSumQbMocks.andWhere.mockReturnValue(expenseSumQbMocks);
    expenseSumQbMocks.groupBy.mockReturnValue(expenseSumQbMocks);

    sectionCreateMock = jest.fn((data) => data);
    sectionSaveMock = jest.fn((entity) => Promise.resolve({ id: 'sec-new-uuid', ...entity }));
    sectionFindOneByMock = jest.fn().mockResolvedValue(null);
    sectionFindMock = jest.fn().mockResolvedValue([]);

    expenseCreateMock = jest.fn((data) => data);
    expenseSaveMock = jest.fn((entity) => Promise.resolve({ id: 'exp-new-uuid', ...entity }));
    expenseFindMock = jest.fn().mockResolvedValue([]);
    expenseFindOneByMock = jest.fn().mockResolvedValue(null);
    expenseUpdateMock = jest.fn().mockResolvedValue({ affected: 1 });

    managerCreateMock = jest.fn((_entity, data) => data);
    managerSaveMock = jest.fn((entity) => Promise.resolve({ id: 'exp-new-uuid', ...entity }));
    managerUpdateMock = jest.fn().mockResolvedValue({ affected: 1 });

    logObservationMock = jest.fn().mockResolvedValue(undefined);

    const module = await Test.createTestingModule({
      providers: [
        ConstructionProjectService,
        {
          provide: getRepositoryToken(ConstructionProjectEntity),
          useValue: {
            create: projectCreateMock,
            save: projectSaveMock,
            findOneBy: projectFindOneByMock,
            createQueryBuilder: jest.fn(() => projectQbMocks),
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
            findOneBy: expenseFindOneByMock,
            update: expenseUpdateMock,
            createQueryBuilder: jest.fn(() => expenseSumQbMocks),
            manager: {
              transaction: jest.fn(async (cb: (manager: unknown) => Promise<unknown>) =>
                cb({
                  create: managerCreateMock,
                  save: managerSaveMock,
                  update: managerUpdateMock,
                }),
              ),
            },
          },
        },
        {
          provide: ConstructionIntelligenceService,
          useValue: {
            logObservation: logObservationMock,
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

  // ADMIN PROJECTS LIST
  describe('listProjects', () => {
    const PROJECT_A = { id: 'proj-a-uuid', name: 'Bahria 1180', status: 'ACTIVE', start_date: '2026-01-15', property_ref: null, owner_contact: '+92 300 1112222', record_type: 'FACT' };
    const PROJECT_B = { id: 'proj-b-uuid', name: 'DHA Renovation', status: 'COMPLETE', start_date: '2026-02-01', property_ref: null, owner_contact: '+92 300 5556666', record_type: 'FACT' };

    it('returns paginated projects with defaults (page 1, limit 20)', async () => {
      projectQbMocks.getManyAndCount.mockResolvedValue([[PROJECT_A, PROJECT_B], 2]);

      const result = await service.listProjects({});

      expect(projectQbMocks.skip).toHaveBeenCalledWith(0);
      expect(projectQbMocks.take).toHaveBeenCalledWith(20);
      expect(result.page).toBe(1);
      expect(result.total_count).toBe(2);
      expect(result.total_pages).toBe(1);
      expect(result.projects).toHaveLength(2);
    });

    it('orders newest-first', async () => {
      await service.listProjects({});
      expect(projectQbMocks.orderBy).toHaveBeenCalledWith('p.created_at', 'DESC');
    });

    it('respects explicit page/limit', async () => {
      projectQbMocks.getManyAndCount.mockResolvedValue([[PROJECT_A], 21]);

      const result = await service.listProjects({ page: 2, limit: 10 });

      expect(projectQbMocks.skip).toHaveBeenCalledWith(10);
      expect(projectQbMocks.take).toHaveBeenCalledWith(10);
      expect(result.page).toBe(2);
      expect(result.total_pages).toBe(3); // ceil(21 / 10)
    });

    it('maps each project to id/name/status/start_date/total, without querying expenses when there are no projects', async () => {
      projectQbMocks.getManyAndCount.mockResolvedValue([[], 0]);

      const result = await service.listProjects({});

      expect(result.projects).toEqual([]);
      expect(expenseSumQbMocks.getRawMany).not.toHaveBeenCalled();
    });

    it('attaches the ACTIVE-only expense sum per project, defaulting to 0 for a project with none', async () => {
      projectQbMocks.getManyAndCount.mockResolvedValue([[PROJECT_A, PROJECT_B], 2]);
      // Only PROJECT_A has a row in the grouped sum result — PROJECT_B has no expenses at all.
      expenseSumQbMocks.getRawMany.mockResolvedValue([{ project_id: 'proj-a-uuid', total: '170000.00' }]);

      const result = await service.listProjects({});

      const a = result.projects.find((p) => p.id === 'proj-a-uuid')!;
      const b = result.projects.find((p) => p.id === 'proj-b-uuid')!;
      expect(a.total).toBe(170000);
      expect(typeof a.total).toBe('number');
      expect(b.total).toBe(0);
      expect(a.name).toBe('Bahria 1180');
      expect(a.status).toBe('ACTIVE');
      expect(a.start_date).toBe('2026-01-15');
    });

    it('filters the sum to status: ACTIVE and scopes it to the current page’s project ids', async () => {
      projectQbMocks.getManyAndCount.mockResolvedValue([[PROJECT_A, PROJECT_B], 2]);

      await service.listProjects({});

      expect(expenseSumQbMocks.where).toHaveBeenCalledWith('e.status = :status', { status: 'ACTIVE' });
      expect(expenseSumQbMocks.andWhere).toHaveBeenCalledWith('s.project_ref IN (:...projectIds)', {
        projectIds: ['proj-a-uuid', 'proj-b-uuid'],
      });
      expect(expenseSumQbMocks.groupBy).toHaveBeenCalledWith('s.project_ref');
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

  // EXPENSE EDIT/DELETE Chunk 1 revised this invariant. Law 3 was never
  // "no edit method may exist" — it's "no existing row's value columns are
  // ever overwritten." editExpense/voidExpense both exist now (tested
  // below); what's asserted here is that neither of them is a raw
  // field-mutation method — see editExpense (new row + targeted CORRECTED
  // update) and voidExpense (targeted status/void_reason update only).
  describe('immutability — corrections supersede, they never overwrite', () => {
    it('has no method that rewrites amount/description/vendor/date on an existing row', () => {
      const svc = service as unknown as Record<string, unknown>;
      expect(svc.updateExpense).toBeUndefined();
      expect(svc.overwriteExpense).toBeUndefined();
      expect(svc.patchExpenseFields).toBeUndefined();
    });
  });

  function buildExistingExpense(overrides: object = {}) {
    return {
      id: 'exp-1',
      section_ref: 'sec-a-uuid',
      expense_date: '2026-01-20',
      description: 'Cupboards',
      vendor_name: 'Malik Woodworks',
      vendor_contact: null,
      linked_contractor_id: null,
      linked_supplier_id: null,
      amount: '45000.00',
      record_type: 'FACT' as const,
      status: 'ACTIVE' as const,
      supersedes_id: null,
      void_reason: null,
      ...overrides,
    };
  }

  const EXISTING_SECTION = {
    id: 'sec-a-uuid',
    project_ref: 'proj-a-uuid',
    category: 'WOODWORK_CARPENTER',
    display_order: 1,
    record_type: 'FACT' as const,
  };

  describe('editExpense', () => {
    it('creates a new ACTIVE row (supersedes_id -> original) and flips the original to CORRECTED, in one transaction', async () => {
      expenseFindOneByMock.mockResolvedValue(buildExistingExpense());
      sectionFindOneByMock.mockResolvedValue(EXISTING_SECTION);

      const edit = buildExpenseInput({ amount: 50000, description: 'Cupboards (corrected quantity)' });
      const result = await service.editExpense('proj-a-uuid', 'exp-1', edit);

      // New row created via the transactional manager, not the plain repo —
      // confirms both writes happen inside expenseRepo.manager.transaction().
      expect(managerCreateMock).toHaveBeenCalledWith(
        ProjectExpenseEntity,
        expect.objectContaining({
          section_ref: 'sec-a-uuid',
          amount: 50000,
          description: 'Cupboards (corrected quantity)',
          status: 'ACTIVE',
          supersedes_id: 'exp-1',
          void_reason: null,
          record_type: 'FACT',
        }),
      );
      expect(managerSaveMock).toHaveBeenCalled();

      // Original flipped to CORRECTED via a targeted update — not a full
      // save() of the original row that would also rewrite its other columns.
      expect(managerUpdateMock).toHaveBeenCalledWith(ProjectExpenseEntity, { id: 'exp-1' }, { status: 'CORRECTED' });

      expect(result.amount).toBe(50000);
      expect(result.supersedes_id).toBe('exp-1');
      expect(result.status).toBe('ACTIVE');
    });

    it('fires an Observation recording old value -> new value (fire-and-forget, via ConstructionIntelligenceService.logObservation)', async () => {
      expenseFindOneByMock.mockResolvedValue(buildExistingExpense());
      sectionFindOneByMock.mockResolvedValue(EXISTING_SECTION);

      await service.editExpense('proj-a-uuid', 'exp-1', buildExpenseInput({ amount: 50000 }));

      expect(logObservationMock).toHaveBeenCalledWith(
        expect.objectContaining({ entity_ref: 'exp-1', metric: 'project_expense_correction' }),
      );
      const call = logObservationMock.mock.calls[0][0] as { old_value: string; new_value: string };
      expect(JSON.parse(call.old_value).amount).toBe(45000);
      expect(JSON.parse(call.new_value).amount).toBe(50000);
    });

    it('rejects editing an expense that does not exist', async () => {
      expenseFindOneByMock.mockResolvedValue(null);

      await expect(service.editExpense('proj-a-uuid', 'non-existent-uuid', buildExpenseInput())).rejects.toThrow(
        NotFoundException,
      );
      expect(managerCreateMock).not.toHaveBeenCalled();
    });

    it('rejects editing an expense that belongs to a different project', async () => {
      expenseFindOneByMock.mockResolvedValue(buildExistingExpense());
      sectionFindOneByMock.mockResolvedValue({ ...EXISTING_SECTION, project_ref: 'some-other-project' });

      await expect(service.editExpense('proj-a-uuid', 'exp-1', buildExpenseInput())).rejects.toThrow(
        NotFoundException,
      );
      expect(managerCreateMock).not.toHaveBeenCalled();
    });

    it.each(['CORRECTED', 'VOID'] as const)(
      'rejects editing an expense that is already %s, with a clear error naming its current status',
      async (status) => {
        expenseFindOneByMock.mockResolvedValue(buildExistingExpense({ status }));
        sectionFindOneByMock.mockResolvedValue(EXISTING_SECTION);

        let caught: unknown;
        try {
          await service.editExpense('proj-a-uuid', 'exp-1', buildExpenseInput());
        } catch (err) {
          caught = err;
        }

        expect(caught).toBeInstanceOf(BadRequestException);
        expect((caught as BadRequestException).message).toContain(status);
        expect(managerCreateMock).not.toHaveBeenCalled();
      },
    );
  });

  describe('voidExpense', () => {
    it('sets status = VOID and void_reason via a targeted update — never a hard delete', async () => {
      expenseFindOneByMock.mockResolvedValue(buildExistingExpense());
      sectionFindOneByMock.mockResolvedValue(EXISTING_SECTION);

      const result = await service.voidExpense('proj-a-uuid', 'exp-1', 'Duplicate entry — same invoice logged twice');

      expect(expenseUpdateMock).toHaveBeenCalledWith(
        { id: 'exp-1' },
        { status: 'VOID', void_reason: 'Duplicate entry — same invoice logged twice' },
      );
      expect(result.status).toBe('VOID');
      expect(result.void_reason).toBe('Duplicate entry — same invoice logged twice');
      // The row's own fields are preserved, not wiped.
      expect(result.amount).toBe(45000);
      expect(result.description).toBe('Cupboards');
    });

    it('fires an Observation for the ACTIVE -> VOID status change, source_ref = the reason', async () => {
      expenseFindOneByMock.mockResolvedValue(buildExistingExpense());
      sectionFindOneByMock.mockResolvedValue(EXISTING_SECTION);

      await service.voidExpense('proj-a-uuid', 'exp-1', 'Entered against the wrong project');

      expect(logObservationMock).toHaveBeenCalledWith({
        entity_ref: 'exp-1',
        metric: 'project_expense_void',
        old_value: 'ACTIVE',
        new_value: 'VOID',
        source_ref: 'Entered against the wrong project',
      });
    });

    it('rejects voiding an expense that belongs to a different project', async () => {
      expenseFindOneByMock.mockResolvedValue(buildExistingExpense());
      sectionFindOneByMock.mockResolvedValue({ ...EXISTING_SECTION, project_ref: 'some-other-project' });

      await expect(service.voidExpense('proj-a-uuid', 'exp-1', 'reason')).rejects.toThrow(NotFoundException);
      expect(expenseUpdateMock).not.toHaveBeenCalled();
    });

    it.each(['CORRECTED', 'VOID'] as const)(
      'rejects deleting an expense that is already %s, with a clear error naming its current status',
      async (status) => {
        expenseFindOneByMock.mockResolvedValue(buildExistingExpense({ status }));
        sectionFindOneByMock.mockResolvedValue(EXISTING_SECTION);

        let caught: unknown;
        try {
          await service.voidExpense('proj-a-uuid', 'exp-1', 'reason');
        } catch (err) {
          caught = err;
        }

        expect(caught).toBeInstanceOf(BadRequestException);
        expect((caught as BadRequestException).message).toContain(status);
        expect(expenseUpdateMock).not.toHaveBeenCalled();
      },
    );
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
        { id: 'exp-1', section_ref: 'sec-wood-uuid', expense_date: '2026-01-20', description: 'Cupboards', vendor_name: 'Malik Woodworks', vendor_contact: null, linked_contractor_id: null, linked_supplier_id: null, amount: '45000.00', record_type: 'FACT', status: 'ACTIVE', supersedes_id: null, void_reason: null },
        { id: 'exp-2', section_ref: 'sec-wood-uuid', expense_date: '2026-01-25', description: 'Wardrobes', vendor_name: 'Malik Woodworks', vendor_contact: null, linked_contractor_id: null, linked_supplier_id: null, amount: '30000.00', record_type: 'FACT', status: 'ACTIVE', supersedes_id: null, void_reason: null },
      ];
      const TILE_EXPENSES = [
        { id: 'exp-3', section_ref: 'sec-tile-uuid', expense_date: '2026-02-01', description: 'Bathroom tiling', vendor_name: 'Ali Tiles', vendor_contact: null, linked_contractor_id: 'con-uuid-001', linked_supplier_id: null, amount: '60000.00', record_type: 'FACT', status: 'ACTIVE', supersedes_id: null, void_reason: null },
      ];
      const ELECTRIC_EXPENSES = [
        { id: 'exp-4', section_ref: 'sec-electric-uuid', expense_date: '2026-02-05', description: 'Wiring', vendor_name: 'City Electric', vendor_contact: null, linked_contractor_id: null, linked_supplier_id: null, amount: '25000.00', record_type: 'FACT', status: 'ACTIVE', supersedes_id: null, void_reason: null },
        { id: 'exp-5', section_ref: 'sec-electric-uuid', expense_date: '2026-02-10', description: 'Fixtures', vendor_name: 'City Electric', vendor_contact: null, linked_contractor_id: null, linked_supplier_id: 'sup-uuid-001', amount: '15000.00', record_type: 'FACT', status: 'ACTIVE', supersedes_id: null, void_reason: null },
        // A correction: overbilled fixtures, entered as a negative amount rather than editing exp-5.
        { id: 'exp-6', section_ref: 'sec-electric-uuid', expense_date: '2026-02-11', description: 'Correction: overbilled fixtures', vendor_name: 'City Electric', vendor_contact: null, linked_contractor_id: null, linked_supplier_id: null, amount: '-5000.00', record_type: 'FACT', status: 'ACTIVE', supersedes_id: null, void_reason: null },
      ];
      expenseFindMock.mockResolvedValue([...WOOD_EXPENSES, ...TILE_EXPENSES, ...ELECTRIC_EXPENSES]);

      const result = await service.getProjectWithSectionsAndExpenses('proj-bahria-uuid');

      expect(result).not.toBeNull();
      expect(result!.name).toBe('Bahria 1180');
      // status: 'ACTIVE' is the totals/list filter (EXPENSE EDIT/DELETE
      // Chunk 1) — see the dedicated test below for why.
      expect(expenseFindMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { section_ref: In(['sec-wood-uuid', 'sec-tile-uuid', 'sec-electric-uuid']), status: 'ACTIVE' },
        }),
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

    // EXPENSE EDIT/DELETE Chunk 1 — every read/sum site must default to
    // ACTIVE-only. This is the one query site every list/total in the app
    // shares (admin dashboard, public project page) — proving the filter
    // here covers all of them.
    it('lists/totals exclude CORRECTED and VOID rows — the query itself filters to status: ACTIVE', async () => {
      projectFindOneByMock.mockResolvedValue({
        id: 'proj-a-uuid',
        ...buildProjectInput(),
        record_type: 'FACT',
      });
      sectionFindMock.mockResolvedValue([
        { id: 'sec-a-uuid', project_ref: 'proj-a-uuid', category: 'WOODWORK_CARPENTER', display_order: 1, record_type: 'FACT' },
      ]);
      // The repo mock can't filter by itself (it's not a real DB) — asserting
      // the exact where clause is what proves the service asks for ACTIVE
      // only, rather than filtering (or failing to filter) after the fact.
      expenseFindMock.mockResolvedValue([buildExistingExpense()]);

      await service.getProjectWithSectionsAndExpenses('proj-a-uuid');

      expect(expenseFindMock).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: 'ACTIVE' }) }),
      );
    });

    // EXPENSE EDIT/DELETE Chunk 2 — admin-only history reveal.
    describe('includeAllStatuses (admin-only history reveal)', () => {
      it('drops the status filter from the query when includeAllStatuses is true', async () => {
        projectFindOneByMock.mockResolvedValue({ id: 'proj-a-uuid', ...buildProjectInput(), record_type: 'FACT' });
        sectionFindMock.mockResolvedValue([
          { id: 'sec-a-uuid', project_ref: 'proj-a-uuid', category: 'WOODWORK_CARPENTER', display_order: 1, record_type: 'FACT' },
        ]);
        expenseFindMock.mockResolvedValue([buildExistingExpense()]);

        await service.getProjectWithSectionsAndExpenses('proj-a-uuid', { includeAllStatuses: true });

        const whereClause = expenseFindMock.mock.calls[0][0].where;
        expect(whereClause).not.toHaveProperty('status');
      });

      it('returns CORRECTED/VOID rows in `expenses`, but subtotal/total still only sum ACTIVE rows', async () => {
        projectFindOneByMock.mockResolvedValue({ id: 'proj-a-uuid', ...buildProjectInput(), record_type: 'FACT' });
        sectionFindMock.mockResolvedValue([
          { id: 'sec-a-uuid', project_ref: 'proj-a-uuid', category: 'WOODWORK_CARPENTER', display_order: 1, record_type: 'FACT' },
        ]);
        expenseFindMock.mockResolvedValue([
          buildExistingExpense({ id: 'exp-active', amount: '45000.00', status: 'ACTIVE' }),
          buildExistingExpense({ id: 'exp-corrected', amount: '40000.00', status: 'CORRECTED' }),
          buildExistingExpense({ id: 'exp-voided', amount: '99999.00', status: 'VOID', void_reason: 'Duplicate entry' }),
        ]);

        const result = await service.getProjectWithSectionsAndExpenses('proj-a-uuid', { includeAllStatuses: true });

        const section = result!.sections[0];
        expect(section.expenses).toHaveLength(3);
        expect(section.expenses.map((e) => e.status).sort()).toEqual(['ACTIVE', 'CORRECTED', 'VOID']);
        expect(section.expenses.find((e) => e.id === 'exp-voided')!.void_reason).toBe('Duplicate entry');
        // Not 45000 + 40000 + 99999 — CORRECTED/VOID amounts never enter the sum.
        expect(section.subtotal).toBe(45000);
        expect(result!.total).toBe(45000);
      });

      it('still filters to status: ACTIVE when includeAllStatuses is false/omitted', async () => {
        projectFindOneByMock.mockResolvedValue({ id: 'proj-a-uuid', ...buildProjectInput(), record_type: 'FACT' });
        sectionFindMock.mockResolvedValue([
          { id: 'sec-a-uuid', project_ref: 'proj-a-uuid', category: 'WOODWORK_CARPENTER', display_order: 1, record_type: 'FACT' },
        ]);
        expenseFindMock.mockResolvedValue([buildExistingExpense()]);

        await service.getProjectWithSectionsAndExpenses('proj-a-uuid', { includeAllStatuses: false });

        expect(expenseFindMock).toHaveBeenCalledWith(
          expect.objectContaining({ where: expect.objectContaining({ status: 'ACTIVE' }) }),
        );
      });
    });
  });
});
