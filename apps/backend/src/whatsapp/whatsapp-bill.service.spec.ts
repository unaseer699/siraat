import { WhatsappBillService, pickExpenseForCaption, savedLinesOf, type SavedLine } from './whatsapp-bill.service';

const line = (description: string) => ({ description, amount: 1 }) as never;
const saved: SavedLine[] = [
  { index: 0, expense_id: 'e1', line: line('Cement 50 bags') },
  { index: 1, expense_id: 'e2', line: line('Bricks 5000') },
  { index: 2, expense_id: 'e3', line: line('Cement delivery charges') },
];

describe('pickExpenseForCaption', () => {
  it('uses the only saved expense without a caption', () => {
    expect(pickExpenseForCaption([saved[0]], null)?.expense_id).toBe('e1');
  });
  it('needs a caption when there are several', () => {
    expect(pickExpenseForCaption(saved, null)).toBeNull();
  });
  it('matches a list number', () => {
    expect(pickExpenseForCaption(saved, '2')?.expense_id).toBe('e2');
    expect(pickExpenseForCaption(saved, '#3')?.expense_id).toBe('e3');
    expect(pickExpenseForCaption(saved, '9')).toBeNull();
  });
  it('matches a word, and refuses when two match equally', () => {
    expect(pickExpenseForCaption(saved, 'bricks bill')?.expense_id).toBe('e2');
    expect(pickExpenseForCaption(saved, 'cement')).toBeNull();
    expect(pickExpenseForCaption(saved, 'cement delivery')?.expense_id).toBe('e3');
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
    const attachments = { attachFromBuffer: jest.fn().mockResolvedValue({}) };
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
    expect(t.attachments.attachFromBuffer).toHaveBeenCalledWith('p1', 'e1', expect.objectContaining({ visible_to_owner: true, content_type: 'image/jpeg' }));
    expect(t.outbound.sendTextMessage.mock.calls[0][1]).toContain('Cement 50 bags');
  });

  it('keeps bills admin-only for admin-mapped numbers', async () => {
    const t = make('founder');
    await t.svc.handle(photo);
    expect(t.attachments.attachFromBuffer).toHaveBeenCalledWith('p1', 'e1', expect.objectContaining({ visible_to_owner: false }));
  });

  it('rejects an unsupported file type', async () => {
    const t = make('self-serve');
    t.outbound.downloadMedia.mockResolvedValue({ data: Buffer.from('x'), mimeType: 'video/mp4' });
    await t.svc.handle(photo);
    expect(t.attachments.attachFromBuffer).not.toHaveBeenCalled();
  });
});
