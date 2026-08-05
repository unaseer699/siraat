import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

/**
 * CAPABILITY 5 SCOPE: Validates a single shared API key (SIRAAT_API_KEY env var).
 * This is intentionally NOT full multi-user OBO per Phase 9's original design — no
 * User/Identity system exists to support that yet. This closes the "accept anything"
 * security gap honestly, without pretending to solve user-level permissions.
 * See REVIEW_BACKLOG.md item: "Full OBO/user-level auth — Target: Future capability"
 */
@Injectable()
export class BearerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>();
    const authHeader = req.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    const expectedKey = process.env.SIRAAT_API_KEY;
    if (!expectedKey || !token || token !== expectedKey) {
      throw new ForbiddenException({
        error_code: 'OBO_PERMISSION_DENIED',
        message: 'Invalid or missing API key',
      });
    }

    return true;
  }
}
