import { WhatsappBillService, pickExpensesForCaption, savedLinesOf, type SavedLine } from './whatsapp-bill.service';

const line = (description: string, amount = 1) => ({ description, amount }) as never;
const saved: SavedLine[] = [
  { index: 0, expense_id: 'e1', line: line('Cement 50 bags', 77000) },
  { index: 1, expense_id: 'e2', line: line('Bricks 5000', 60000) },
  { index: 2, expense_id: 'e3', line: line('Cement delivery charges', 3000) },
];
const ids = (r: SavedLine[] | null) => r?.map((x) => x.expense_id) ?? null;

describe('pickExpensesForCaption', () => {
  it('uses the only saved expense without a caption', () => {
    expect(ids(pickExpensesForCaption([saved[0]], null))).toEqual(['e1']);
  });
  it('needs a caption when there are several', () => {
    expect(pickExpensesForCaption(saved, null)).toBeNull();
  });
  it('matches one or several list numbers', () => {
    expect(ids(pickExpensesForCaption(saved, '2'))).toEqual(['e2']);
    expect(ids(pickExpensesForCaption(saved, '#3'))).toEqual(['e3']);
    expect(ids(pickExpensesForCaption(saved, '1,2'))).toEqual(['e1', 'e2']);
    expect(ids(pickExpensesForCaption(saved, '1 and 3'))).toEqual(['e1', 'e3']);
    expect(pickExpensesForCaption(saved, '9')).toBeNull();
  });
  it('treats "all", "both" and "consolidated" as every saved expense', () => {
    expect(ids(pickExpensesForCaption(saved, 'ALL'))).toEqual(['e1', 'e2', 'e3']);
    expect(ids(pickExpensesForCaption(saved, 'consolidated bill'))).toEqual(['e1', 'e2', 'e3']);
    expect(ids(pickExpensesForCaption(saved.slice(0, 2), 'both'))).toEqual(['e1', 'e2']);
  });
  it('uses an amount in the caption: the grand total means all, one line amount means that line', () => {
    const two = saved.slice(0, 2); // 77000 + 60000 = 137000
    expect(ids(pickExpensesForCaption(two, 'paid 137,000 to the supplier'))).toEqual(['e1', 'e2']);
    expect(ids(pickExpensesForCaption(saved, 'paid 60000'))).toEqual(['e2']);
    expect(pickExpensesForCaption(saved, 'paid 12345')).toBeNull();
  });
  it('matches a word, and refuses when two match equally', () => {
    expect(ids(pickExpensesForCaption(saved, 'bricks bill'))).toEqual(['e2']);
    expect(pickExpensesForCaption(saved, 'cement')).toBeNull();
    expect(ids(pickExpensesForCaption(saved, 'cement delivery'))).toEqual(['e3']);
  });
});

describe('the consolidated-bill case', () => {
  it('"paid 90000 consolidated bill" attaches to both Sand and Crush', () => {
    const sandCrush: SavedLine[] = [
      { index: 0, expense_id: 's', line: line('Sand 600 cft', 40000) },
      { index: 1, expense_id: 'c', line: line('Crush 600 cft', 50000) },
    ];
    expect(ids(pickExpensesForCaption(sandCrush, 'paid 90000 consolidated bill'))).toEqual(['s', 'c']);
    expect(ids(pickExpensesForCaption(sandCrush, '90000'))).toEqual(['s', 'c']);
    expect(ids(pickExpensesForCaption(sandCrush, 'ALL'))).toEqual(['s', 'c']);
  });
});

describe('savedLinesOf', () => {
  it('keeps only lines that saved', () => {
    const r = savedLinesOf({
      lines: [line('A'), line('B')],
      result: [{ index: 0, ok: true, expense_id: 'x' }, { index: 1, ok: false, error: 'bad' }],
    } as never);
    expect(r.map((s) => s.expense_id)).toEqual(['x']);
  });
});

describe('WhatsappBillService.handle', () => {
  function make(mappingCreatedBy: string | null) {
    const batch = {
      project_ref: 'p1',
      lines: [line('Cement 50 bags')],
      result: [{ index: 0, ok: true, expense_id: 'e1' }],
    };
    const qb: Record<string, jest.Mock> = {};
    for (const k of ['innerJoin', 'where', 'andWhere', 'orderBy']) qb[k] = jest.fn(() => qb);
    qb.getOne = jest.fn().mockResolvedValue(batch);
    const batchRepo = { createQueryBuilder: jest.fn(() => qb) };
    const mappingRepo = { findOneBy: jest.fn().mockResolvedValue(mappingCreatedBy ? { created_by: mappingCreatedBy } : null) };
    const attachments = { attachFromBufferToExpenses: jest.fn().mockResolvedValue([]) };
    const outbound = {
      downloadMedia: jest.fn().mockResolvedValue({ data: Buffer.from('x'), mimeType: 'image/jpeg' }),
      sendTextMessage: jest.fn().mockResolvedValue(undefined),
    };
    const svc = new WhatsappBillService(batchRepo as never, mappingRepo as never, attachments as never, outbound as never);
    return { svc, attachments, outbound };
  }
  const photo = { wa_id: '9230', message_type: 'image', message_text: null, raw_payload: { image: { id: 'm1' } } } as never;

  it('attaches the photo and shows it to a self-serve owner', async () => {
    const t = make('self-serve');
    await t.svc.handle(photo);
    expect(t.attachments.attachFromBufferToExpenses).toHaveBeenCalledWith('p1', ['e1'], expect.objectContaining({ visible_to_owner: true, content_type: 'image/jpeg' }));
    expect(t.outbound.sendTextMessage.mock.calls[0][1]).toContain('Cement 50 bags');
  });

  it('keeps bills admin-only for admin-mapped numbers', async () => {
    const t = make('founder');
    await t.svc.handle(photo);
    expect(t.attachments.attachFromBufferToExpenses).toHaveBeenCalledWith('p1', ['e1'], expect.objectContaining({ visible_to_owner: false }));
  });

  it('rejects an unsupported file type', async () => {
    const t = make('self-serve');
    t.outbound.downloadMedia.mockResolvedValue({ data: Buffer.from('x'), mimeType: 'video/mp4' });
    await t.svc.handle(photo);
    expect(t.attachments.attachFromBufferToExpenses).not.toHaveBeenCalled();
  });
});
