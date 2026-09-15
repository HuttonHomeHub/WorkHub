/**
 * The authenticated principal and the ownership model (ADR-0016).
 *
 * Every account is an individual user; resources belong to exactly one user
 * via an `ownerId` column. There are no organisations, roles, or permission
 * codes — authorisation is a single question: *does the requester own the
 * resource?* Services answer it with {@link Principal.owns} on the loaded row
 * (the defence against IDOR), and creation always derives the owner from the
 * session, never from client input.
 */

/** The shape a resource must expose for an ownership check. */
export interface Owned {
  ownerId: string;
}

/**
 * The authenticated user. Immutable and request-scoped; resolved from the
 * Better Auth session by `AuthContextService` and attached to the request by
 * the authentication guard.
 */
export class Principal {
  constructor(
    readonly userId: string,
    readonly email: string,
    readonly name: string,
  ) {}

  /**
   * True if the principal owns the resource. The authoritative authorisation
   * check — services MUST call this on every loaded resource before acting on
   * it (see docs/SECURITY_STANDARDS.md).
   */
  owns(resource: Owned): boolean {
    return resource.ownerId === this.userId;
  }
}
