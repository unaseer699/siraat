import { buildBatchSummary, isCancelReply, isExpenseBatchMessage, projectNamesMatch } from './whatsapp-expense-batch.service';

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
