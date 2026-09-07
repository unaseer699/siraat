import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Headers,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { WhatsappService } from './whatsapp.service';

// Minimal shapes of what's needed from the underlying Fastify request/reply —
// avoids importing the 'fastify' package directly, matching the existing
// convention (see RecommendationsController's ReplyLike).
interface RequestWithRawBody {
  rawBody?: Buffer;
}
interface ReplyLike {
  header(name: string, value: string): unknown;
}

// WHATSAPP INTEGRATION Phase 1 — receiving/verification/mapping layer only.
// Deliberately unauthenticated: Meta calls this directly, there is no
// Bearer key to send. Every requirement here is [SECURITY] per the brief —
// the verify-token handshake (GET) and the X-Hub-Signature-256 check (POST)
// are the only things standing between this endpoint and the open internet.
@Controller('v1/webhooks/whatsapp')
export class WhatsappWebhookController {
  constructor(private readonly waSvc: WhatsappService) {}

  // Meta's one-time webhook verification handshake, run when the webhook URL
  // is registered/changed in the Meta App Dashboard. [SECURITY] constant-time
  // token comparison — see WhatsappService.verifyToken.
  @Get()
  verify(
    @Query('hub.mode') mode: string | undefined,
    @Query('hub.verify_token') token: string | undefined,
    @Query('hub.challenge') challenge: string | undefined,
    @Res({ passthrough: true }) res: ReplyLike,
  ): string {
    if (mode !== 'subscribe' || !this.waSvc.verifyToken(token)) {
      throw new ForbiddenException({
        error_code: 'WEBHOOK_VERIFICATION_FAILED',
        message: 'Invalid verify token',
      });
    }

    // Meta expects the raw challenge value back as the body, not JSON.
    res.header('Content-Type', 'text/plain');
    return challenge ?? '';
  }

  // [SECURITY] Rate-limited (global ThrottlerModule config — 60/min, see
  // AppModule) so a compromised/misbehaving sender can't flood storage.
  @Post()
  @UseGuards(ThrottlerGuard)
  @HttpCode(200)
  async receive(
    @Req() req: RequestWithRawBody,
    @Body() body: unknown,
    @Headers('x-hub-signature-256') signature: string | undefined,
  ): Promise<{ received: boolean }> {
    // [SECURITY] Verified against the RAW body bytes (req.rawBody, populated
    // by main.ts's `rawBody: true` NestFactory option) — not the JSON-parsed
    // `body` above, which would break HMAC validation (re-serializing parsed
    // JSON does not reliably reproduce the exact bytes Meta signed). No
    // fallback: missing or mismatched signature is always rejected.
    if (!this.waSvc.verifySignature(req.rawBody, signature)) {
      throw new UnauthorizedException({
        error_code: 'INVALID_SIGNATURE',
        message: 'Webhook signature verification failed',
      });
    }

    // Fast ack: Phase 1's only processing IS the store step (no AI parsing,
    // no Expense creation), so it's awaited directly — nothing slower is
    // deferred past this response in this phase.
    await this.waSvc.handleWebhookPayload(body);

    return { received: true };
  }
}
