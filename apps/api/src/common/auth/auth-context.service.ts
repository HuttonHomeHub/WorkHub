import { Inject, Injectable } from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';

import { AUTH_INSTANCE, type AuthInstance } from './auth.instance';
import { Principal } from './principal';

/**
 * Resolves the {@link Principal} for a request. This is the **authentication
 * seam**: it validates the Better Auth session cookie (ADR-0003) and hydrates
 * the principal. Unauthenticated requests resolve to `null` → denied by the
 * authentication guard (secure by default).
 *
 * It is deliberately isolated behind this service so the rest of the app never
 * depends on the auth library, and so tests can supply a principal by
 * overriding this provider (see the reference e2e test).
 */
@Injectable()
export class AuthContextService {
  constructor(@Inject(AUTH_INSTANCE) private readonly auth: AuthInstance) {}

  async resolve(request: Request): Promise<Principal | null> {
    const session = await this.auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });
    if (!session) return null;
    return new Principal(session.user.id, session.user.email, session.user.name);
  }
}
