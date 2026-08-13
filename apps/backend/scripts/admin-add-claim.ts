/**
 * Admin Add Claim Tool
 *
 * Adds an ADDITIONAL Verification claim to an EXISTING society.
 * Use this when a society has multiple distinct claims — e.g. a verified NOC
 * AND a separate illegal-scheme notice on a specific block.
 *
 * To onboard a brand-new society with its first claim, use admin-add-society.ts instead.
 *
 * Run:
 *   pnpm --filter backend exec ts-node \
 *     -P scripts/tsconfig.scripts.json \
 *     scripts/admin-add-claim.ts
 *
 * Targets DATABASE_URL from the environment (defaults to local dev DB if unset).
 * To target production: export DATABASE_URL=<do-managed-postgres-url> before running.
 */

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import * as readline from 'readline';
import { AppModule } from '../src/app.module';
import { AdminService } from '../src/admin/admin.service';
import { TrustService } from '../src/trust/trust.service';
import { PropertyIntelligenceService } from '../src/property-intelligence/property-intelligence.service';
import {
  ask,
  askRequired,
  askYesNo,
  askClaimType,
  askVerificationStatus,
  collectEvidence,
  type EvidenceInput,
} from './prompts';

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║   Siraat — Admin Add Claim Tool                  ║');
  console.log('╚══════════════════════════════════════════════════╝\n');
  console.log('Database:', process.env.DATABASE_URL ?? '(default: local dev)');
  console.log('This tool adds one new Verification claim to an existing society.\n');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const adminSvc = app.get(AdminService);
  // piSvc and trustSvc are used for display-only lookups (no DB writes)
  const piSvc = app.get(PropertyIntelligenceService);
  const trustSvc = app.get(TrustService);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  try {
    // ── Step 1: Identify the society ─────────────────────────────────────────

    console.log('── SOCIETY ─────────────────────────────────────────');

    let society: Awaited<ReturnType<typeof piSvc.findSocietyById>>;
    while (true) {
      const rawId = (await ask(rl, 'Society UUID: ')).trim();
      if (!rawId) {
        console.log('  ! Society ID is required.');
        continue;
      }
      society = await piSvc.findSocietyById(rawId);
      if (society) break;
      console.log(`  ✗ No society found with ID "${rawId}". Check the ID and try again.`);
    }

    console.log(`\n  Found: ${society!.name} (${society!.city})`);
    console.log(`  ID:    ${society!.id}`);

    // Show existing claims so the operator knows what's already on record
    const existing = await trustSvc.getVerifications('SOCIETY', society!.id);
    if (existing.length > 0) {
      console.log(`\n  Existing claims (${existing.length}):`);
      for (const { verification: v } of existing) {
        console.log(`    · [${v.claim_type}] ${v.status} — "${v.claim}"`);
      }
    } else {
      console.log('\n  No existing claims on record.');
    }

    // ── Step 2: New claim ────────────────────────────────────────────────────

    console.log('\n── NEW CLAIM ───────────────────────────────────────');

    const claimType = await askClaimType(rl);
    const claim = await askRequired(rl, 'Claim description (e.g. "Blue Bell Block — Illegal Scheme Notice")');
    const targetStatus = await askVerificationStatus(rl);

    // ── Step 3: Evidence ─────────────────────────────────────────────────────

    let evidenceItems: EvidenceInput[] = [];

    if (targetStatus === 'VERIFIED') {
      console.log('\n── EVIDENCE (at least one required for VERIFIED status) ─');
      evidenceItems = await collectEvidence(rl, { required: true });
      if (evidenceItems.length === 0) {
        console.error('\n  ✗ Cannot create VERIFIED claim with zero evidence. Aborting.');
        process.exit(1);
      }
    } else if (targetStatus === 'DISPUTED') {
      console.log('\n── EVIDENCE (optional — attach the notice document if available) ─');
      evidenceItems = await collectEvidence(rl, { required: false });
    }
    // PENDING: no evidence section

    // ── Confirmation ─────────────────────────────────────────────────────────

    console.log('\n── SUMMARY ─────────────────────────────────────────');
    console.log(`  Society:      ${society!.name} (${society!.city})`);
    console.log(`  Society ID:   ${society!.id}`);
    console.log(`  Existing claims: ${existing.length}`);
    console.log();
    console.log(`  New claim:`);
    console.log(`    Type:    ${claimType}`);
    console.log(`    Status:  ${targetStatus}`);
    console.log(`    Claim:   "${claim}"`);
    console.log(`    Evidence: ${evidenceItems.length} item(s)`);
    if (evidenceItems.length > 0) {
      for (const item of evidenceItems) {
        console.log(`      · [${item.type}] ${item.file_ref} — ${item.source_ref}`);
      }
    }
    console.log();

    const confirmed = await askYesNo(rl, 'Proceed and write to database?');
    if (!confirmed) {
      console.log('  Aborted — no changes written.');
      process.exit(0);
    }

    // ── Write to database ─────────────────────────────────────────────────────

    console.log('\nWriting to database...');

    const result = await adminSvc.addClaimToSociety({
      society_id: society!.id,
      claim,
      claim_type: claimType,
      target_status: targetStatus,
      evidence: evidenceItems,
    });

    console.log(`  ✓ Claim created:        ${result.verification_id}`);
    console.log(`    Status: ${targetStatus}${evidenceItems.length > 0 ? `, ${evidenceItems.length} evidence item(s) linked` : ''}`);

    console.log('\n✓ Done. New claim added successfully.');
    console.log(`  Society:      ${society!.name} (${society!.id})`);
    console.log(`  New claim ID: ${result.verification_id}`);
    console.log(`  Total claims: ${existing.length + 1}\n`);

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`\n✗ Error: ${message}`);
    process.exit(1);
  } finally {
    rl.close();
    await app.close();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
