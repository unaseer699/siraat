import { WhatsappExpenseBatchService } from './whatsapp-expense-batch.service';
import { buildBatchSummary, isCancelReply, isExpenseBatchMessage, isLedgerLinesMessage, projectNamesMatch } from './whatsapp-expense-batch.service';

describe('expense batch helpers', () => {
  it('detects ledger messages', () => {
    expect(isExpenseBatchMessage('Project Expense:\nProject Name: X')).toBe(true);
    expect(isExpenseBatchMessage('cement 50 bags')).toBe(false);
  });
  it('recognizes cancel replies', () => {
    expect(isCancelReply('Cancel')).toBe(true);
    expect(isCancelReply('yes')).toBe(false);
  });
  it('matches project names loosely', () => {
    expect(projectNamesMatch('2 Kanal Farm House', '2 kanal farm house')).toBe(true);
    expect(projectNamesMatch('Other Site', '2 Kanal Farm House')).toBe(false);
  });
  it('builds a summary with total and prompt', () => {
    const t = buildBatchSummary('P', [
      { date: '2026-09-12', description: 'Duck', amount: 4000, quantity: null, unit: null, vendor: 'Not specified', paid_by: 'Abu', trade_category: 'MISCELLANEOUS', kind: null, raw_line: '' },
    ], 4000);
    expect(t).toContain('Total: 4,000');
    expect(t).toContain('paid by Abu');
    expect(t).toContain('Reply YES');
  });
});

describe('heading detection', () => {
  it('detects the heading after a title line and in plural', () => {
    expect(isExpenseBatchMessage('THE COURTYARD\nProject Expenses\nDuck - 4000')).toBe(true);
  });
  it('ignores ordinary inventory messages', () => {
    expect(isExpenseBatchMessage('Society: Faisal Hills\n5 Marla plot\n10 Marla plot\nProject Expense later')).toBe(false);
  });
});

describe('project-name header', () => {
  it('treats a Project Name line at the top as a ledger', () => {
    expect(isExpenseBatchMessage('Project Name: THE COURTYARD\n\nItems\nDuck - 4000')).toBe(true);
  });
});

describe('isLedgerLinesMessage', () => {
  it('accepts short name - amount lists, with or without a Project Name line', () => {
    expect(isLedgerLinesMessage('Jabbar Labour - 100000')).toBe(true);
    expect(isLedgerLinesMessage('Project Name: THE COURTYARD\n\nJabbar Labour - 100000\nCement 50 bags- 76000')).toBe(true);
  });
  it('rejects ordinary chat, rate messages and single expenses with @', () => {
    expect(isLedgerLinesMessage('Hello, how is the work going?')).toBe(false);
    expect(isLedgerLinesMessage('Cement: 1300 /bag')).toBe(false);
    expect(isLedgerLinesMessage('cement 50 bags @ 1490')).toBe(false);
    expect(isLedgerLinesMessage('Project Name: THE COURTYARD')).toBe(false);
  });
});

describe('parseAndStoreBatch when the AI call fails', () => {
  it('falls back to the plain reader and still asks for confirmation', async () => {
    const replies: string[] = [];
    const saved: Array<{ lines: Array<{ description: string; amount: number; trade_category: string }> }> = [];
    const svc = Object.create(WhatsappExpenseBatchService.prototype);
    Object.assign(svc, {
      logger: { error: jest.fn() },
      cpSvc: { findProjectById: async () => ({ name: 'THE COURTYARD' }), findCategoryRule: async () => null },
      aiClient: { extractExpenseBatch: async () => { throw new Error('Anthropic API returned 401'); } },
      inboundRepo: { update: jest.fn() },
      batchRepo: { update: jest.fn(), create: (x: never) => x, save: async (x: never) => { saved.push(x); return x; } },
      reply: async (_to: string, text: string) => { replies.push(text); },
    });
    await svc.parseAndStoreBatch({
      id: 'm1', status: 'RECEIVED', project_ref: 'p1', wa_id: '923001234567', wa_timestamp: new Date('2026-10-21'),
      message_text: 'Project Name: THE COURTYARD \nCement  50 bags - 77000',
    });
    expect(saved[0].lines[0]).toMatchObject({ amount: 77000, trade_category: 'CEMENT' });
    expect(replies[0]).toContain('Found 1 expenses');
    expect(replies[0]).toContain('smart reader was unavailable');
    expect(replies[0]).not.toContain('could not read');
  });
});
