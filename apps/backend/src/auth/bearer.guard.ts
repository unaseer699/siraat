import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

/**
 * Accepts any Bearer token — enforcement activates in Capability 5 (OBO validation).
 * The header plumbing is wired now so Capability 5 only needs to swap this guard.
 */
@Injectable()
export class BearerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    // Capability 1-4: accept the header, do not enforce content.
    // Capability 5+ will verify the OBO token and return 403 on failure.
    return true;
  }
}
