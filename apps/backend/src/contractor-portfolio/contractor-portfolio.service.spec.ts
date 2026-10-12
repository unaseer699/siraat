import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { ContractorPortfolioService } from './contractor-portfolio.service';

const CID = '11111111-1111-1111-1111-111111111111';
const KEY = `contractor-portfolio/${CID}/22222222-2222-2222-2222-222222222222.jpg`;
const fields = { title: 'House', society_name: null, city: null, plot_size: null, completed_year: null, description: null };

function build(opts: { link?: { contractor_id: string; revoked_at: Date | null } | null; pending?: number; head?: { size: number; contentType: string | null } | null } = {}) {
  const saved: Record<string, unknown>[] = [];
  const projects = {
    create: (x: Record<string, unknown>) => ({ id: 'p1', created_at: new Date(), ...x }),
    save: async (x: Record<string, unknown>) => (saved.push(x), x),
    count: async () => opts.pending ?? 0,
  };
  const links = { findOneBy: async () => (opts.link === undefined ? { contractor_id: CID, revoked_at: null } : opts.link) };
  const storage = {
    headObject: async () => (opts.head === undefined ? { size: 1000, contentType: 'image/jpeg' } : opts.head),
    getPresignedDownloadUrl: async () => 'https://signed',
  };
  const pi = { findContractorById: async () => ({ id: CID, name: 'Ali' }) };
  const svc = new ContractorPortfolioService(projects as never, links as never, storage as never, pi as never);
  return { svc, saved };
}

describe('ContractorPortfolioService', () => {
  it('contractor submissions are PENDING_REVIEW and tagged UNTRUSTED_DATA', async () => {
    const { svc, saved } = build();
    await svc.submitByContractor('tok', fields, [KEY]);
    expect(saved[0]).toMatchObject({ status: 'PENDING_REVIEW', source: 'CONTRACTOR', trust_tag: 'UNTRUSTED_DATA' });
  });

  it('admin projects are published straight away', async () => {
    const { svc, saved } = build();
    await svc.createByAdmin(CID, fields, [KEY]);
    expect(saved[0]).toMatchObject({ status: 'PUBLISHED', source: 'ADMIN' });
  });

  it('rejects an unknown or revoked link', async () => {
    await expect(build({ link: null }).svc.submitByContractor('x', fields, [KEY])).rejects.toBeInstanceOf(NotFoundException);
    await expect(build({ link: { contractor_id: CID, revoked_at: new Date() } }).svc.submitByContractor('x', fields, [KEY])).rejects.toBeInstanceOf(NotFoundException);
  });

  it('requires a photo from a contractor', async () => {
    await expect(build().svc.submitByContractor('tok', fields, [])).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects a photo key outside the contractor's own folder", async () => {
    const other = 'contractor-portfolio/99999999-9999-9999-9999-999999999999/22222222-2222-2222-2222-222222222222.jpg';
    await expect(build().svc.submitByContractor('tok', fields, [other])).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects oversize files and wrong types', async () => {
    await expect(build({ head: { size: 9 * 1024 * 1024, contentType: 'image/jpeg' } }).svc.submitByContractor('tok', fields, [KEY])).rejects.toBeInstanceOf(BadRequestException);
    await expect(build({ head: { size: 100, contentType: 'application/pdf' } }).svc.submitByContractor('tok', fields, [KEY])).rejects.toBeInstanceOf(BadRequestException);
  });

  it('caps projects waiting for review', async () => {
    await expect(build({ pending: 10 }).svc.submitByContractor('tok', fields, [KEY])).rejects.toBeInstanceOf(ConflictException);
  });

  it('only stores the hash of a new link token', async () => {
    const saved: Record<string, unknown>[] = [];
    const links = {
      createQueryBuilder: () => ({ update: () => ({ set: () => ({ where: () => ({ execute: async () => ({}) }) }) }) }),
      create: (x: Record<string, unknown>) => x,
      save: async (x: Record<string, unknown>) => (saved.push(x), x),
    };
    const svc = new ContractorPortfolioService({} as never, links as never, {} as never, { findContractorById: async () => ({ id: CID }) } as never);
    const { token } = await svc.createLink(CID);
    expect(saved[0].token_hash).toBe(createHash('sha256').update(token).digest('hex'));
    expect(JSON.stringify(saved[0])).not.toContain(token);
  });
});
