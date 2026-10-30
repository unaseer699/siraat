import { WhatsappSelfServeService, extractNewProjectName, isNewProjectMessage, isReportRequest, parseProjectCommand, projectSlug, reportLink } from './whatsapp-self-serve.service';

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

describe('report link', () => {
  it('recognises REPORT messages only', () => {
    expect(isReportRequest('Report')).toBe(true);
    expect(isReportRequest('my report!')).toBe(true);
    expect(isReportRequest('report on cement')).toBe(false);
  });

  it('replies with the private link for each linked project', async () => {
    process.env.PUBLIC_SITE_URL = 'https://app.example.com/';
    const t = make(null);
    (t.mappingRepo as unknown as { find: jest.Mock }).find = jest.fn().mockResolvedValue([{ project_ref: 'p1' }]);
    (t.cpSvc as unknown as { findProjectById: jest.Mock }).findProjectById = jest.fn().mockResolvedValue({ id: 'p1', name: 'My House' });
    const ok = await t.svc.handleReportRequest(msg('REPORT'));
    expect(ok).toBe(true);
    expect(t.outbound.sendTextMessage.mock.calls[0][1]).toContain('https://app.example.com/project/my-house-p1');
    delete process.env.PUBLIC_SITE_URL;
  });

  it('returns false when the sender has no project', async () => {
    const t = make(null);
    (t.mappingRepo as unknown as { find: jest.Mock }).find = jest.fn().mockResolvedValue([]);
    expect(await t.svc.handleReportRequest(msg('REPORT'))).toBe(false);
  });
});

describe('project commands', () => {
  it('parses commands and optional names', () => {
    expect(parseProjectCommand('SHARE')).toEqual({ action: 'SHARE', name: null });
    expect(parseProjectCommand('share yes')).toEqual({ action: 'SHARE_YES', name: null });
    expect(parseProjectCommand('Share YES My House')).toEqual({ action: 'SHARE_YES', name: 'My House' });
    expect(parseProjectCommand('unshare: Villa')).toEqual({ action: 'UNSHARE', name: 'Villa' });
    expect(parseProjectCommand('Project Name: X\nCement 50 bags - 77000')).toBeNull();
    expect(parseProjectCommand('sharing the bill')).toBeNull();
  });

  function withProjects(projects: Array<Record<string, unknown>>) {
    const t = make(null);
    (t.mappingRepo as unknown as { find: jest.Mock }).find = jest.fn().mockResolvedValue(projects.map((p) => ({ project_ref: p.id })));
    (t.cpSvc as unknown as Record<string, jest.Mock>).findProjectById = jest.fn(async (id: string) => projects.find((p) => p.id === id));
    (t.cpSvc as unknown as Record<string, jest.Mock>).updateProject = jest.fn().mockResolvedValue({});
    return t;
  }
  const home = { id: 'p1', name: 'My House', status: 'ACTIVE', is_public: false };
  const run = async (t: ReturnType<typeof withProjects>, text: string) => {
    const matched = await t.svc.matchProjectCommand('923001112222', text);
    if (matched) await t.svc.handleProjectCommand(msg(text), matched);
    return matched;
  };
  const upd = (t: ReturnType<typeof withProjects>) => (t.cpSvc as never as Record<string, jest.Mock>).updateProject;

  it('SHARE asks for confirmation and changes nothing', async () => {
    const t = withProjects([home]);
    expect(await run(t, 'SHARE')).not.toBeNull();
    expect(upd(t)).not.toHaveBeenCalled();
    expect(t.outbound.sendTextMessage.mock.calls[0][1]).toContain('SHARE YES');
  });

  it('SHARE YES publishes and says it appears once finished', async () => {
    const t = withProjects([home]);
    await run(t, 'SHARE YES');
    expect(upd(t)).toHaveBeenCalledWith('p1', { is_public: true });
    expect(t.outbound.sendTextMessage.mock.calls[0][1]).toContain('DONE');
  });

  it('DONE marks complete; UNSHARE hides', async () => {
    const t = withProjects([{ ...home, is_public: true }]);
    await run(t, 'DONE');
    expect(upd(t)).toHaveBeenCalledWith('p1', { status: 'COMPLETE' });
    await run(t, 'UNSHARE');
    expect(upd(t)).toHaveBeenCalledWith('p1', { is_public: false });
  });

  it('ordinary text that starts with a command word is not a command', async () => {
    const t = withProjects([home]);
    expect(await run(t, 'Done with the slab, paid 50000')).toBeNull();
    expect(upd(t)).not.toHaveBeenCalled();
    expect(await run(t, 'done my house')).not.toBeNull();
  });

  it('with several projects it asks which one', async () => {
    const t = withProjects([home, { id: 'p2', name: 'Shop Plaza', status: 'ACTIVE', is_public: false }]);
    await run(t, 'SHARE YES');
    expect(upd(t)).not.toHaveBeenCalled();
    expect(t.outbound.sendTextMessage.mock.calls[0][1]).toContain('Which project');
    await run(t, 'SHARE YES shop plaza');
    expect(upd(t)).toHaveBeenCalledWith('p2', { is_public: true });
  });

  it('returns null when the sender has no self-serve project', async () => {
    expect(await run(withProjects([]), 'SHARE')).toBeNull();
  });
});

describe('report link with the project name', () => {
  it('builds a readable slug', () => {
    expect(projectSlug('My House (Phase 2)')).toBe('my-house-phase-2');
    expect(projectSlug('THE COURTYARD')).toBe('the-courtyard');
    expect(projectSlug('گھر')).toBe('');
    expect(projectSlug('A'.repeat(80)).length).toBeLessThanOrEqual(40);
  });
  it('puts the id last and works without a usable name', () => {
    expect(reportLink('https://x.com', { id: 'abc', name: 'Test House' })).toBe('https://x.com/project/test-house-abc');
    expect(reportLink('https://x.com', { id: 'abc', name: 'گھر' })).toBe('https://x.com/project/abc');
  });
});
