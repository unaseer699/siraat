import { WhatsappSelfServeService, extractNewProjectName, isNewProjectMessage } from './whatsapp-self-serve.service';

function make(account: Record<string, unknown> | null, owned = 0, used = 0) {
  const accountRepo = {
    findOneBy: jest.fn().mockResolvedValue(account),
    create: jest.fn((x) => ({ plan: 'TRIAL', trial_expense_limit: 25, paid_until: null, ...x })),
    save: jest.fn(async (x) => x),
  };
  const mappingRepo = { count: jest.fn().mockResolvedValue(owned), create: jest.fn((x) => x), save: jest.fn(async (x) => x) };
  const inboundRepo = { update: jest.fn().mockResolvedValue({}) };
  const cpSvc = {
    createProject: jest.fn(async (d) => ({ id: 'p1', name: d.name })),
    countActiveExpenses: jest.fn().mockResolvedValue(used),
  };
  const outbound = { sendTextMessage: jest.fn().mockResolvedValue(undefined) };
  const svc = new WhatsappSelfServeService(accountRepo as never, mappingRepo as never, inboundRepo as never, cpSvc as never, outbound as never);
  return { svc, accountRepo, mappingRepo, cpSvc, outbound };
}
const msg = (text: string) => ({ id: 'm1', wa_id: '923001112222', message_text: text }) as never;

describe('new project message', () => {
  it('detects and extracts the name', () => {
    expect(isNewProjectMessage('New Project: My House')).toBe(true);
    expect(extractNewProjectName('start project - Villa 5')).toBe('Villa 5');
    expect(isNewProjectMessage('Project Name: X\nCement 50 bags - 77000')).toBe(false);
  });
});

describe('WhatsappSelfServeService', () => {
  beforeEach(() => {
    delete process.env.WHATSAPP_ADMIN_NUMBERS;
  });

  it('creates a project, maps the sender and starts a trial', async () => {
    const t = make(null);
    await t.svc.handleNewProject(msg('New Project: My House'));
    expect(t.cpSvc.createProject).toHaveBeenCalledWith(expect.objectContaining({ name: 'My House', owner_contact: '923001112222' }));
    expect(t.mappingRepo.save).toHaveBeenCalledWith(expect.objectContaining({ wa_id: '923001112222', project_ref: 'p1', created_by: 'self-serve' }));
    expect(t.accountRepo.save).toHaveBeenCalled();
    expect(t.outbound.sendTextMessage.mock.calls[0][1]).toContain('Free trial');
  });

  it('refuses a second project on the trial', async () => {
    const t = make({ plan: 'TRIAL', trial_expense_limit: 25, paid_until: null }, 1);
    await t.svc.handleNewProject(msg('New Project: Another'));
    expect(t.cpSvc.createProject).not.toHaveBeenCalled();
    expect(t.outbound.sendTextMessage.mock.calls[0][1]).toContain('one live project');
  });

  it('allows more projects on an active paid plan', async () => {
    const t = make({ plan: 'PAID', trial_expense_limit: 25, paid_until: new Date(Date.now() + 86400000) }, 3);
    await t.svc.handleNewProject(msg('New Project: Another'));
    expect(t.cpSvc.createProject).toHaveBeenCalled();
  });

  it('blocks a blocked number', async () => {
    const t = make({ plan: 'BLOCKED' });
    await t.svc.handleNewProject(msg('New Project: X'));
    expect(t.cpSvc.createProject).not.toHaveBeenCalled();
  });

  it('quota: no account means unlimited (admin-mapped numbers)', async () => {
    expect((await make(null).svc.checkExpenseQuota('923001112222', 'p1', 500)).allowed).toBe(true);
  });

  it('quota: trial stops when the limit would be exceeded', async () => {
    const t = make({ plan: 'TRIAL', trial_expense_limit: 25, paid_until: null }, 1, 22);
    const r = await t.svc.checkExpenseQuota('923001112222', 'p1', 5);
    expect(r.allowed).toBe(false);
    const ok = await t.svc.checkExpenseQuota('923001112222', 'p1', 3);
    expect(ok.allowed).toBe(true);
  });

  it('quota: expired paid plan is refused', async () => {
    const t = make({ plan: 'PAID', paid_until: new Date(Date.now() - 1000), trial_expense_limit: 25 });
    expect((await t.svc.checkExpenseQuota('923001112222', 'p1', 1)).allowed).toBe(false);
  });

  it('quota: owner numbers are never limited', async () => {
    process.env.WHATSAPP_ADMIN_NUMBERS = '923001112222';
    const t = make({ plan: 'TRIAL', trial_expense_limit: 1, paid_until: null }, 0, 100);
    expect((await t.svc.checkExpenseQuota('923001112222', 'p1', 5)).allowed).toBe(true);
  });
});
