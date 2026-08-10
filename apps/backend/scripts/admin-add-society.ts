/**
 * Admin Society Onboarding Tool
 *
 * Creates one Society + its initial Verification + Evidence records in the database.
 * This is a founder-only CLI tool — NOT a public API endpoint.
 *
 * Run:
 *   pnpm --filter backend exec ts-node \
 *     -P scripts/tsconfig.scripts.json \
 *     scripts/admin-add-society.ts
 *
 * Targets DATABASE_URL from the environment (defaults to local dev DB if unset).
 * To target production: export DATABASE_URL=<do-managed-postgres-url> before running.
 */

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import * as readline from 'readline';
import { AppModule } from '../src/app.module';
import { TrustService } from '../src/trust/trust.service';
import { PropertyIntelligenceService } from '../src/property-intelligence/property-intelligence.service';

// ── Prompt helper ─────────────────────────────────────────────────────────────

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function askOptionalNumber(rl: readline.Interface, label: string): Promise<number | null> {
  const raw = (await ask(rl, `${label} (press Enter to skip): `)).trim();
  if (!raw) return null;
  const n = Number(raw);
  if (isNaN(n) || n < 0) {
    console.log(`  ! Invalid number, using null.`);
    return null;
  }
  return n;
}

async function askRequired(rl: readline.Interface, label: string): Promise<string> {
  let value = '';
  while (!value.trim()) {
    value = await ask(rl, `${label}: `);
    if (!value.trim()) console.log('  ! This field is required.');
  }
  return value.trim();
}

async function askYesNo(rl: readline.Interface, question: string): Promise<boolean> {
  while (true) {
    const ans = (await ask(rl, `${question} [y/n]: `)).trim().toLowerCase();
    if (ans === 'y' || ans === 'yes') return true;
    if (ans === 'n' || ans === 'no') return false;
    console.log('  ! Please answer y or n.');
  }
}

async function askVerificationStatus(
  rl: readline.Interface,
): Promise<'VERIFIED' | 'PENDING' | 'DISPUTED'> {
  while (true) {
    const s = (await ask(rl, 'Verification status [PENDING / VERIFIED / DISPUTED]: ')).trim().toUpperCase();
    if (s === 'PENDING' || s === 'VERIFIED' || s === 'DISPUTED') {
      return s as 'VERIFIED' | 'PENDING' | 'DISPUTED';
    }
    console.log('  ! Must be PENDING, VERIFIED, or DISPUTED.');
  }
}

async function askEvidenceType(
  rl: readline.Interface,
): Promise<'document' | 'photo' | 'receipt' | 'inspection_report'> {
  while (true) {
    const t = (
      await ask(rl, 'Evidence type [document / photo / receipt / inspection_report]: ')
    ).trim().toLowerCase();
    if (t === 'document' || t === 'photo' || t === 'receipt' || t === 'inspection_report') {
      return t as 'document' | 'photo' | 'receipt' | 'inspection_report';
    }
    console.log('  ! Must be document, photo, receipt, or inspection_report.');
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║   Siraat — Admin Society Onboarding Tool         ║');
  console.log('╚══════════════════════════════════════════════════╝\n');
  console.log('Database:', process.env.DATABASE_URL ?? '(default: local dev)');
  console.log('This tool creates ONE society at a time with real, verified data.\n');

  // Bootstrap NestJS application context (no HTTP server — DI only)
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const piSvc = app.get(PropertyIntelligenceService);
  const trustSvc = app.get(TrustService);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  try {
    // ── Section 1: Society ──────────────────────────────────────────────────

    console.log('── SOCIETY ─────────────────────────────────────────');

    const name = await askRequired(rl, 'Society name');
    const city = await askRequired(rl, 'City');
    const nocApproved = await askYesNo(rl, 'NOC approved?');
    const minPrice = await askOptionalNumber(rl, 'Min price (PKR)');
    const maxPrice = await askOptionalNumber(rl, 'Max price (PKR)');
    const minAreaMarla = await askOptionalNumber(rl, 'Min area (marla)');
    const maxAreaMarla = await askOptionalNumber(rl, 'Max area (marla)');

    const typesRaw = (
      await ask(rl, 'Property types (comma-separated: PLOT, HOUSE, APARTMENT, COMMERCIAL): ')
    ).trim();
    const propertyTypes = typesRaw
      ? typesRaw.split(',').map((t) => t.trim().toUpperCase()).filter(Boolean)
      : ['PLOT'];

    const baseConfidenceRaw = (
      await ask(rl, 'Base confidence (0.0–1.0, e.g. 0.85): ')
    ).trim();
    const baseConfidence = parseFloat(baseConfidenceRaw);
    if (isNaN(baseConfidence) || baseConfidence < 0 || baseConfidence > 1) {
      console.error('  ✗ Invalid confidence score. Aborting.');
      process.exit(1);
    }

    const isAffiliated = await askYesNo(rl, 'Is Siraat-affiliated?');
    let affiliationDisclosure: string | null = null;
    if (isAffiliated) {
      affiliationDisclosure = await askRequired(rl, 'Affiliation disclosure text');
    }

    const nocSummaryRaw = (await ask(rl, 'NOC summary (press Enter to skip): ')).trim();
    const nocSummary = nocSummaryRaw || null;

    // ── Section 2: Verification ─────────────────────────────────────────────

    console.log('\n── VERIFICATION ────────────────────────────────────');

    const targetStatus = await askVerificationStatus(rl);
    const claim = await askRequired(rl, 'Verification claim (e.g. "NOC Approved by CDA")');

    // ── Section 3: Evidence (required if VERIFIED) ──────────────────────────

    const evidenceItems: Array<{
      type: 'document' | 'photo' | 'receipt' | 'inspection_report';
      file_ref: string;
      source_ref: string;
    }> = [];

    if (targetStatus === 'VERIFIED') {
      console.log('\n── EVIDENCE (at least one required for VERIFIED status) ─');
      let addMore = true;
      while (addMore) {
        console.log(`\nEvidence item #${evidenceItems.length + 1}:`);
        const type = await askEvidenceType(rl);
        const fileRef = await askRequired(rl, 'File reference (e.g. trust/society/noc.pdf)');
        const sourceRef = await askRequired(rl, 'Source reference (e.g. CDA Portal — NOC No. X)');
        evidenceItems.push({ type, file_ref: fileRef, source_ref: sourceRef });

        if (evidenceItems.length >= 1) {
          addMore = await askYesNo(rl, 'Add another evidence item?');
        }
      }
    }

    // Validate before touching the DB: VERIFIED requires evidence
    if (targetStatus === 'VERIFIED' && evidenceItems.length === 0) {
      console.error('\n  ✗ Cannot create VERIFIED verification with zero evidence. Aborting.');
      process.exit(1);
    }

    // ── Confirmation ─────────────────────────────────────────────────────────

    console.log('\n── SUMMARY ─────────────────────────────────────────');
    console.log(`  Society:      ${name} (${city})`);
    console.log(`  NOC:          ${nocApproved ? 'Approved' : 'Not approved'}`);
    console.log(`  Confidence:   ${baseConfidence}`);
    console.log(`  Affiliated:   ${isAffiliated ? 'Yes — ' + affiliationDisclosure : 'No'}`);
    console.log(`  Verification: ${targetStatus} — "${claim}"`);
    console.log(`  Evidence:     ${evidenceItems.length} item(s)`);
    console.log();

    const confirmed = await askYesNo(rl, 'Proceed and write to database?');
    if (!confirmed) {
      console.log('  Aborted — no changes written.');
      process.exit(0);
    }

    // ── Write to database ─────────────────────────────────────────────────────

    console.log('\nWriting to database...');

    // 1. Create society
    const society = await piSvc.createSociety({
      name,
      city,
      min_price: minPrice,
      max_price: maxPrice,
      min_area_marla: minAreaMarla,
      max_area_marla: maxAreaMarla,
      property_types: propertyTypes,
      noc_approved: nocApproved,
      base_confidence: baseConfidence,
      is_siraat_affiliated: isAffiliated,
      affiliation_disclosure: affiliationDisclosure,
      noc_summary: nocSummary,
    });
    console.log(`  ✓ Society created:      ${society.id}`);

    // 2. Create verification (PENDING first — evidence links update it)
    await trustSvc.createVerification({
      subject_type: 'SOCIETY',
      subject_id: society.id,
      claim,
      status: 'PENDING',
      evidence_refs: [],
    });
    console.log(`  ✓ Verification created: PENDING`);

    // 3. Link evidence (reuses the same logic as reviewSubmission acceptance path)
    for (const item of evidenceItems) {
      const ev = await trustSvc.createAndLinkEvidence(society.id, item);
      console.log(`  ✓ Evidence linked:      ${ev.id} (${item.type})`);
    }

    // 4. Promote to target status if VERIFIED
    if (targetStatus === 'VERIFIED') {
      const ver = await trustSvc.promoteToVerified(society.id);
      console.log(`  ✓ Verification promoted: ${ver.status} at ${ver.verified_at?.toISOString()}`);
    }

    console.log('\n✓ Done. Society onboarded successfully.');
    console.log(`  Society ID: ${society.id}`);
    console.log(`  Use this ID in queries and as linked_to in evidence submissions.\n`);

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
