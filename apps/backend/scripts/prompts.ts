/**
 * Shared interactive prompt helpers for Siraat admin CLI scripts.
 *
 * All functions are readline-based and work with process.stdin / process.stdout.
 * Import these into admin scripts — do not duplicate them inline.
 */

import * as readline from 'readline';
import type { ClaimType } from '../src/trust/trust.service';

export function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

export async function askOptionalNumber(
  rl: readline.Interface,
  label: string,
): Promise<number | null> {
  const raw = (await ask(rl, `${label} (press Enter to skip): `)).trim();
  if (!raw) return null;
  const n = Number(raw);
  if (isNaN(n) || n < 0) {
    console.log(`  ! Invalid number, using null.`);
    return null;
  }
  return n;
}

export async function askRequired(rl: readline.Interface, label: string): Promise<string> {
  let value = '';
  while (!value.trim()) {
    value = await ask(rl, `${label}: `);
    if (!value.trim()) console.log('  ! This field is required.');
  }
  return value.trim();
}

export async function askYesNo(rl: readline.Interface, question: string): Promise<boolean> {
  while (true) {
    const ans = (await ask(rl, `${question} [y/n]: `)).trim().toLowerCase();
    if (ans === 'y' || ans === 'yes') return true;
    if (ans === 'n' || ans === 'no') return false;
    console.log('  ! Please answer y or n.');
  }
}

export async function askClaimType(rl: readline.Interface): Promise<ClaimType> {
  const options: ClaimType[] = [
    'NOC',
    'PLANNING_APPROVAL',
    'COMPLETION_CERTIFICATE',
    'SHOW_CAUSE_NOTICE',
    'ILLEGAL_SCHEME_NOTICE',
    'TRANSFER_DEED',
    'MORTGAGE_DEED',
    'OTHER',
  ];
  const display = options.join(' / ');
  while (true) {
    const raw = (
      await ask(rl, `Claim type [${display}] (default: NOC): `)
    )
      .trim()
      .toUpperCase();
    if (!raw) return 'NOC';
    if (options.includes(raw as ClaimType)) return raw as ClaimType;
    console.log(`  ! Must be one of: ${display}`);
  }
}

export async function askVerificationStatus(
  rl: readline.Interface,
): Promise<'VERIFIED' | 'PENDING' | 'DISPUTED'> {
  while (true) {
    const s = (
      await ask(rl, 'Verification status [PENDING / VERIFIED / DISPUTED]: ')
    )
      .trim()
      .toUpperCase();
    if (s === 'PENDING' || s === 'VERIFIED' || s === 'DISPUTED') {
      return s as 'VERIFIED' | 'PENDING' | 'DISPUTED';
    }
    console.log('  ! Must be PENDING, VERIFIED, or DISPUTED.');
  }
}

export async function askEvidenceType(
  rl: readline.Interface,
): Promise<'document' | 'photo' | 'receipt' | 'inspection_report'> {
  while (true) {
    const t = (
      await ask(
        rl,
        'Evidence type [document / photo / receipt / inspection_report]: ',
      )
    )
      .trim()
      .toLowerCase();
    if (
      t === 'document' ||
      t === 'photo' ||
      t === 'receipt' ||
      t === 'inspection_report'
    ) {
      return t as 'document' | 'photo' | 'receipt' | 'inspection_report';
    }
    console.log('  ! Must be document, photo, receipt, or inspection_report.');
  }
}

export type EvidenceInput = {
  type: 'document' | 'photo' | 'receipt' | 'inspection_report';
  file_ref: string;
  source_ref: string;
};

/**
 * Prompts the user to enter one or more evidence items.
 * Pass `required: true` to enforce at least one item (used for VERIFIED claims).
 * Pass `required: false` to make the whole section optional (used for DISPUTED).
 */
export async function collectEvidence(
  rl: readline.Interface,
  opts: { required: boolean },
): Promise<EvidenceInput[]> {
  const items: EvidenceInput[] = [];

  if (!opts.required) {
    const wants = await askYesNo(rl, 'Add evidence for this claim?');
    if (!wants) return [];
  }

  let addMore = true;
  while (addMore) {
    console.log(`\nEvidence item #${items.length + 1}:`);
    const type = await askEvidenceType(rl);
    const file_ref = await askRequired(rl, 'File reference (e.g. trust/society/notice.pdf)');
    const source_ref = await askRequired(
      rl,
      'Source reference (e.g. LDA Portal — Notice No. X)',
    );
    items.push({ type, file_ref, source_ref });
    addMore = await askYesNo(rl, 'Add another evidence item?');
  }

  return items;
}
