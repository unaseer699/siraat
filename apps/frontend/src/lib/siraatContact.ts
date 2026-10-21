// Siraat's own WhatsApp number (international digits, no + or spaces).
// Change it here, or set NEXT_PUBLIC_SIRAAT_WHATSAPP on Vercel.
export const SIRAAT_WHATSAPP = (process.env.NEXT_PUBLIC_SIRAAT_WHATSAPP ?? '923237733113').replace(/\D/g, '');

export function siraatWhatsAppUrl(message: string): string {
  return `https://wa.me/${SIRAAT_WHATSAPP}?text=${encodeURIComponent(message)}`;
}
