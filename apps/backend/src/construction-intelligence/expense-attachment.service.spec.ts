import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ExpenseAttachmentService } from './expense-attachment.service';

function build() {
  const repo = {
    create: jest.fn((x) => ({ ...x, id: 'b1', created_at: new Date('2026-01-01') })),
    save: jest.fn(async (x) => x),
    find: jest.fn(async (_o?: unknown) => []),
    update: jest.fn(async () => ({ affected: 1 })),
    findOneBy: jest.fn(),
    delete: jest.fn(),
  };
  const expenseRepo = { findOneBy: jest.fn() };
  const sectionRepo = { findOneBy: jest.fn() };
  const storage = {
    getPresignedUploadUrl: jest.fn(async () => 'https://up'),
    getPresignedDownloadUrl: jest.fn(async () => 'https://down'),
    headObject: jest.fn(async () => ({ size: 1000 })),
    deleteFile: jest.fn(async () => undefined),
  };
  const svc = new ExpenseAttachmentService(repo as never, expenseRepo as never, sectionRepo as never, storage as never);
  return { svc, repo, expenseRepo, sectionRepo, storage };
}

describe('ExpenseAttachmentService', () => {
  it('rejects unsupported file types', async () => {
    const { svc } = build();
    await expect(svc.requestUpload('p1', { filename: 'a.exe', content_type: 'application/x-msdownload' })).rejects.toThrow(BadRequestException);
  });

  it('issues a key under the project bills prefix', async () => {
    const { svc } = build();
    const r = await svc.requestUpload('p1', { filename: 'bill 1.pdf', content_type: 'application/pdf' });
    expect(r.key.startsWith('projects/p1/bills/')).toBe(true);
  });

  it('rejects a key from another project', async () => {
    const { svc } = build();
    await expect(
      svc.attach('p1', 'e1', { key: 'projects/p2/bills/x', filename: 'a.pdf', content_type: 'application/pdf', visible_to_owner: false }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects an expense from another project', async () => {
    const { svc, expenseRepo, sectionRepo } = build();
    expenseRepo.findOneBy.mockResolvedValue({ id: 'e1', section_ref: 's1' });
    sectionRepo.findOneBy.mockResolvedValue({ id: 's1', project_ref: 'other' });
    await expect(
      svc.attach('p1', 'e1', { key: 'projects/p1/bills/x', filename: 'a.pdf', content_type: 'application/pdf', visible_to_owner: false }),
    ).rejects.toThrow(NotFoundException);
  });

  it('deletes oversize files and refuses them', async () => {
    const { svc, expenseRepo, sectionRepo, storage } = build();
    expenseRepo.findOneBy.mockResolvedValue({ id: 'e1', section_ref: 's1' });
    sectionRepo.findOneBy.mockResolvedValue({ id: 's1', project_ref: 'p1' });
    storage.headObject.mockResolvedValue({ size: 11 * 1024 * 1024 });
    await expect(
      svc.attach('p1', 'e1', { key: 'projects/p1/bills/x', filename: 'a.pdf', content_type: 'application/pdf', visible_to_owner: false }),
    ).rejects.toThrow(/10 MB/);
    expect(storage.deleteFile).toHaveBeenCalled();
  });

  it('saves a valid bill as admin-only by default value passed', async () => {
    const { svc, expenseRepo, sectionRepo, repo } = build();
    expenseRepo.findOneBy.mockResolvedValue({ id: 'e1', section_ref: 's1' });
    sectionRepo.findOneBy.mockResolvedValue({ id: 's1', project_ref: 'p1' });
    const r = await svc.attach('p1', 'e1', { key: 'projects/p1/bills/x', filename: 'a.pdf', content_type: 'application/pdf', visible_to_owner: false });
    expect(r.visible_to_owner).toBe(false);
    expect(repo.save).toHaveBeenCalled();
  });

  it('owner view lists only visible bills', async () => {
    const { svc, repo } = build();
    await svc.list('p1', { ownerView: true });
    expect((repo.find.mock.calls[0][0] as { where: unknown }).where).toEqual({ project_ref: 'p1', visible_to_owner: true });
  });
});
