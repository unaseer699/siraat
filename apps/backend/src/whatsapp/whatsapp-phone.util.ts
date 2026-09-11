// Split out of whatsapp.service.ts (Phase 1) so it can be shared without an
// import cycle: WhatsappService imports WhatsappConfirmationService (Phase 3,
// for DI), so WhatsappConfirmationService cannot import anything back from
// whatsapp.service.ts without creating a circular require. Both now import
// this instead. whatsapp.service.ts re-exports `maskPhone` from here so
// existing `import { maskPhone } from './whatsapp.service'` call sites (and
// tests) are unaffected.

// [SECURITY] No PII beyond what's needed in logs — last 4 digits only.
export function maskPhone(waId: string): string {
  if (waId.length <= 4) return '*'.repeat(waId.length);
  return '*'.repeat(waId.length - 4) + waId.slice(-4);
}
