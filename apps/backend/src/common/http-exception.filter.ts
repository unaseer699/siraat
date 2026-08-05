import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<{ status: (code: number) => { send: (data: unknown) => void } }>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse() as string | Record<string, unknown>;

      // If the body already carries error_code (e.g. BearerGuard), forward it as-is
      if (typeof res === 'object' && 'error_code' in res) {
        reply.status(status).send(res);
        return;
      }

      const message =
        typeof res === 'string'
          ? res
          : typeof (res as Record<string, unknown>).message === 'string'
            ? (res as Record<string, unknown>).message as string
            : 'An error occurred';

      reply.status(status).send({ error_code: this.toErrorCode(status), message });
      return;
    }

    console.error('[AllExceptionsFilter] Unhandled exception:', exception);
    reply.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
      error_code: 'INTERNAL_ERROR',
      message: 'An internal error occurred',
    });
  }

  private toErrorCode(status: number): string {
    if (status === 429) return 'RATE_LIMIT_EXCEEDED';
    if (status === 404) return 'NOT_FOUND';
    if (status === 400) return 'VALIDATION_ERROR';
    if (status === 403) return 'OBO_PERMISSION_DENIED';
    if (status === 422) return 'UNPROCESSABLE_ENTITY';
    return 'INTERNAL_ERROR';
  }
}
