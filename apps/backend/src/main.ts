import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    // logger: true enables Fastify's built-in pino logger (method, url, status, responseTime)
    new FastifyAdapter({ logger: true }),
    // WHATSAPP INTEGRATION Phase 1 — rawBody: true populates request.rawBody
    // (Buffer) alongside normal JSON parsing, needed to verify Meta's
    // X-Hub-Signature-256 HMAC against the exact bytes it signed. Global
    // option, but only WhatsappWebhookController reads req.rawBody — every
    // other route's @Body() parsing is unaffected.
    { rawBody: true },
  );

  // Global filter: ensures all unhandled errors return { error_code, message } — never raw stacks
  app.useGlobalFilters(new AllExceptionsFilter());

  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    // allowedHeaders was previously unset. 'x-siraat-country-code' is sent
    // on every frontend request (apiFetch, lib/api.ts) but was never added
    // here — a non-simple request (any POST/PATCH/DELETE, or one carrying
    // this custom header) fails CORS preflight unless the header is
    // explicitly allowlisted. Explicit list rather than relying on default
    // reflection behavior, so this doesn't silently break again if the
    // underlying CORS defaults ever change.
    allowedHeaders: ['Authorization', 'Content-Type', 'x-siraat-country-code'],
  });

  const port = parseInt(process.env.PORT ?? '3001', 10);
  await app.listen(port, '0.0.0.0');
  console.log(`Siraat backend running on http://0.0.0.0:${port}`);
}

bootstrap();
