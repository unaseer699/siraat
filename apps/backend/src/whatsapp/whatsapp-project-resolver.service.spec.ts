import { extractProjectName, pickClosest } from './whatsapp-project-resolver.service';

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
