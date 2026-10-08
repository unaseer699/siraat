import { WhatsappProjectResolverService, extractProjectName, pickClosest } from './whatsapp-project-resolver.service';

const projects = [
  { id: '1', name: '2 Kanal Farm House' },
  { id: '2', name: 'DHA Phase 6 House' },
];

describe('project resolver helpers', () => {
  it('extracts the project name line', () => {
    expect(extractProjectName('Project Expense:\nProject Name: 2 Kanal Farm House\nDuck - 4000')).toBe('2 Kanal Farm House');
    expect(extractProjectName('cement 50 bags')).toBeNull();
  });
  it('picks the closest project', () => {
    expect(pickClosest('2 kanal farmhouse', projects)?.id).toBe('1');
    expect(pickClosest('DHA house', projects)?.id).toBe('2');
  });
  it('returns null when nothing is close', () => {
    expect(pickClosest('Lahore Mall', projects)).toBeNull();
  });
});

describe('title-line project name', () => {
  it('reads a title line before the heading', () => {
    expect(extractProjectName('THE COURTYARD\nProject Expenses\nDuck - 4000')).toBe('THE COURTYARD');
  });
  it('reads a name after the heading', () => {
    expect(extractProjectName('Project Expenses - The Courtyard\nDuck - 4000')).toBe('The Courtyard');
  });
});

describe('owner numbers', () => {
  const cp = {
    listProjects: jest.fn().mockResolvedValue({ projects: [{ id: 'a', name: 'THE COURTYARD' }, { id: 'v', name: 'THE VISTA' }] }),
    findProjectById: jest.fn(async (id: string) => ({ id, name: id === 'a' ? 'THE COURTYARD' : 'THE VISTA' })),
  };
  const svc = new WhatsappProjectResolverService({} as never, {} as never, cp as never, {} as never);
  afterEach(() => delete process.env.WHATSAPP_ADMIN_NUMBERS);

  it('adds every project for an owner number and picks by the Project Name line', async () => {
    process.env.WHATSAPP_ADMIN_NUMBERS = '923237733113, 923001111111';
    const stored = [{ wa_id: '923237733113', project_ref: 'a' }] as never;
    const all = await svc.withOwnerProjects('923237733113', stored);
    expect(all.map((m) => m.project_ref).sort()).toEqual(['a', 'v']);
    const r = await svc.resolve('923237733113', 'Project Name: THE VISTA\nDuck - 4000', all);
    expect(r).toEqual({ kind: 'resolved', project_ref: 'v' });
  });

  it('leaves other numbers on their explicit mappings', async () => {
    process.env.WHATSAPP_ADMIN_NUMBERS = '923237733113';
    const stored = [{ wa_id: '92300', project_ref: 'a' }] as never;
    expect(await svc.withOwnerProjects('92300', stored)).toBe(stored);
  });
});
